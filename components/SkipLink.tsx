/**
 * Skip Link Component
 * 
 * Provides skip navigation links for keyboard users
 * to bypass repetitive content and jump to main sections.
 * 
 * @module components/SkipLink
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ===========================================
// Types
// ===========================================

export interface SkipLinkTarget {
  /** Target element ID (without #) */
  id: string;
  /** Link label */
  label: string;
}

export interface SkipLinkProps {
  /** Skip link targets */
  targets?: SkipLinkTarget[];
  /** Additional className */
  className?: string;
}

// ===========================================
// Default Targets
// ===========================================

const defaultTargets: SkipLinkTarget[] = [
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'main-navigation', label: 'Skip to navigation' },
];

// ===========================================
// Component
// ===========================================

/**
 * SkipLink - Keyboard navigation skip links
 * 
 * Add this component at the very top of your layout,
 * before any other content.
 * 
 * @example
 * ```tsx
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <SkipLink />
 *         <nav id="main-navigation">...</nav>
 *         <main id="main-content">...</main>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export const SkipLink: React.FC<SkipLinkProps> = ({
  targets = defaultTargets,
  className,
}) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    
    const target = document.getElementById(id);
    if (target) {
      // Ensure target is focusable
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      
      // Focus and scroll
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  return (
    <div className={cn('skip-links', className)}>
      {targets.map((target) => (
        <a
          key={target.id}
          href={`#${target.id}`}
          onClick={(e) => handleClick(e, target.id)}
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
            focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white 
            focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 
            focus:ring-blue-400 focus:ring-offset-2"
        >
          {target.label}
        </a>
      ))}
    </div>
  );
};

// ===========================================
// Focus Indicator Component
// ===========================================

export interface FocusIndicatorProps {
  /** Show focus ring on all focusable elements */
  global?: boolean;
}

/**
 * FocusIndicator - Adds visible focus indicators
 * 
 * This component adds a style tag that ensures focus
 * indicators are visible for keyboard navigation.
 */
export const FocusIndicator: React.FC<FocusIndicatorProps> = ({
  global = true,
}) => {
  if (!global) return null;
  
  return (
    <style jsx global>{`
      /* Focus visible styles for keyboard navigation */
      :focus-visible {
        outline: 2px solid #3b82f6 !important;
        outline-offset: 2px !important;
      }
      
      /* Remove default outline for mouse users */
      :focus:not(:focus-visible) {
        outline: none;
      }
      
      /* High contrast mode support */
      @media (forced-colors: active) {
        :focus-visible {
          outline: 2px solid CanvasText !important;
        }
      }
      
      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `}</style>
  );
};

// ===========================================
// Live Region Component
// ===========================================

export interface LiveRegionProps {
  /** Message to announce */
  message: string;
  /** Announcement priority */
  priority?: 'polite' | 'assertive';
  /** Render visually hidden */
  visuallyHidden?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * LiveRegion - Announces content changes to screen readers
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  priority = 'polite',
  visuallyHidden = true,
  className,
}) => {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className={cn(
        visuallyHidden && 'sr-only',
        className
      )}
    >
      {message}
    </div>
  );
};

// ===========================================
// Visually Hidden Component
// ===========================================

export interface VisuallyHiddenProps {
  /** Content (accessible to screen readers) */
  children: React.ReactNode;
  /** Element tag */
  as?: keyof JSX.IntrinsicElements;
}

/**
 * VisuallyHidden - Hide content visually but keep it accessible
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Component = 'span',
}) => {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
};

export default SkipLink;
