/**
 * Session Timeout Hook
 * 
 * Client-side hook for managing session timeout with auto-logout.
 * Tracks user activity and shows warning before session expires.
 * 
 * @module hooks/useSessionTimeout
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ===========================================
// Configuration
// ===========================================

/**
 * Session timeout configuration
 */
interface SessionTimeoutConfig {
  /** Session timeout in milliseconds (default: 15 minutes) */
  timeout?: number;
  /** Warning shown X ms before timeout (default: 2 minutes) */
  warningBefore?: number;
  /** Events that reset the timeout */
  activityEvents?: string[];
  /** Callback when session is about to expire */
  onWarning?: (remainingMs: number) => void;
  /** Callback when session expires */
  onTimeout?: () => void;
  /** Callback when session is extended */
  onExtend?: () => void;
  /** Whether to auto-logout on timeout */
  autoLogout?: boolean;
  /** Logout redirect path */
  logoutPath?: string;
}

const DEFAULT_CONFIG: Required<SessionTimeoutConfig> = {
  timeout: 15 * 60 * 1000,       // 15 minutes
  warningBefore: 2 * 60 * 1000,  // 2 minutes warning
  activityEvents: ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'],
  onWarning: () => {},
  onTimeout: () => {},
  onExtend: () => {},
  autoLogout: true,
  logoutPath: '/sign-in?timeout=true',
};

// ===========================================
// Hook State
// ===========================================

interface SessionState {
  isActive: boolean;
  showWarning: boolean;
  remainingMs: number;
  lastActivity: number;
}

// ===========================================
// Main Hook
// ===========================================

/**
 * useSessionTimeout - Manages session timeout with activity tracking
 * 
 * @param config - Configuration options
 * @returns Session state and control functions
 * 
 * @example
 * ```tsx
 * const { showWarning, remainingMs, extendSession } = useSessionTimeout({
 *   timeout: 10 * 60 * 1000,
 *   onWarning: (ms) => console.log(`Session expires in ${ms}ms`),
 * });
 * ```
 */
export const useSessionTimeout = (config?: SessionTimeoutConfig) => {
  const router = useRouter();
  
  // Merge with defaults
  const {
    timeout,
    warningBefore,
    activityEvents,
    onWarning,
    onTimeout,
    onExtend,
    autoLogout,
    logoutPath,
  } = { ...DEFAULT_CONFIG, ...config };
  
  // State
  const [state, setState] = useState<SessionState>({
    isActive: true,
    showWarning: false,
    remainingMs: timeout,
    lastActivity: Date.now(),
  });
  
  // Refs for timers
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);
  
  // Handle timeout
  const handleTimeout = useCallback(() => {
    clearTimers();
    setState(prev => ({ ...prev, isActive: false, showWarning: false }));
    onTimeout();
    
    if (autoLogout) {
      // Store timeout flag for displaying message on login page
      sessionStorage.setItem('session_timeout', 'true');
      router.push(logoutPath);
    }
  }, [clearTimers, onTimeout, autoLogout, logoutPath, router]);
  
  // Handle warning
  const handleWarning = useCallback(() => {
    setState(prev => ({ ...prev, showWarning: true }));
    
    // Start countdown interval
    intervalRef.current = setInterval(() => {
      setState(prev => {
        const remaining = Math.max(0, timeout - (Date.now() - prev.lastActivity));
        onWarning(remaining);
        return { ...prev, remainingMs: remaining };
      });
    }, 1000);
  }, [timeout, onWarning]);
  
  // Reset timeout (on user activity)
  const resetTimeout = useCallback(() => {
    clearTimers();
    
    const now = Date.now();
    
    setState({
      isActive: true,
      showWarning: false,
      remainingMs: timeout,
      lastActivity: now,
    });
    
    // Set warning timer
    warningRef.current = setTimeout(handleWarning, timeout - warningBefore);
    
    // Set timeout timer
    timeoutRef.current = setTimeout(handleTimeout, timeout);
  }, [clearTimers, timeout, warningBefore, handleWarning, handleTimeout]);
  
  // Extend session (dismiss warning)
  const extendSession = useCallback(() => {
    resetTimeout();
    onExtend();
  }, [resetTimeout, onExtend]);
  
  // Force logout
  const logout = useCallback(() => {
    clearTimers();
    setState(prev => ({ ...prev, isActive: false }));
    router.push(logoutPath);
  }, [clearTimers, logoutPath, router]);
  
  // Activity handler with throttling
  const lastActivityUpdate = useRef(0);
  const handleActivity = useCallback(() => {
    const now = Date.now();
    // Throttle activity updates to once per second
    if (now - lastActivityUpdate.current > 1000) {
      lastActivityUpdate.current = now;
      resetTimeout();
    }
  }, [resetTimeout]);
  
  // Set up event listeners
  useEffect(() => {
    // Initial setup
    resetTimeout();
    
    // Add activity listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    
    // Visibility change handler (pause on hidden, resume on visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if session should have expired while tab was hidden
        const elapsed = Date.now() - state.lastActivity;
        if (elapsed >= timeout) {
          handleTimeout();
        } else {
          // Recalculate remaining time
          setState(prev => ({
            ...prev,
            remainingMs: timeout - elapsed,
            showWarning: elapsed >= timeout - warningBefore,
          }));
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      clearTimers();
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount - dependencies are refs and stable callbacks
  
  return {
    /** Whether the session is active */
    isActive: state.isActive,
    /** Whether the warning should be shown */
    showWarning: state.showWarning,
    /** Remaining time in milliseconds */
    remainingMs: state.remainingMs,
    /** Formatted remaining time (mm:ss) */
    remainingFormatted: formatTime(state.remainingMs),
    /** Last activity timestamp */
    lastActivity: state.lastActivity,
    /** Extend the session (reset timeout) */
    extendSession,
    /** Force logout */
    logout,
  };
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Formats milliseconds to mm:ss
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ===========================================
// Session Timeout Warning Component
// ===========================================

export interface SessionWarningProps {
  remainingMs: number;
  onExtend: () => void;
  onLogout: () => void;
}

/**
 * Default warning message component
 * Can be used with the hook or replaced with custom UI
 */
export const SessionTimeoutWarning: React.FC<SessionWarningProps> = ({
  remainingMs,
  onExtend,
  onLogout,
}) => {
  return (
    <div
      role="alertdialog"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h2 
          id="session-timeout-title"
          className="text-xl font-semibold text-gray-900 mb-2"
        >
          Session Expiring Soon
        </h2>
        <p 
          id="session-timeout-desc"
          className="text-gray-600 mb-4"
        >
          Your session will expire in{' '}
          <span className="font-bold text-red-600">
            {formatTime(remainingMs)}
          </span>
          . Would you like to continue?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onLogout}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="Log out now"
          >
            Log Out
          </button>
          <button
            onClick={onExtend}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label="Continue session"
            autoFocus
          >
            Continue Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default useSessionTimeout;
