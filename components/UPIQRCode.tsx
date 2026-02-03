/**
 * UPI QR Code Component
 * 
 * Displays a UPI QR code for payments with countdown timer,
 * multiple payment options, and accessibility support.
 * 
 * @module components/UPIQRCode
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  generateUPIUri, 
  generateTransactionRef,
  getUPIAppDeepLink,
  isUPIAvailable,
  openUPIPayment,
  formatUPIIdForDisplay,
  getUPIAppsList,
  UPIDetails,
  UPI_CONFIG,
} from '@/lib/upi';
import { formatINR } from '@/lib/currency';
import { cn } from '@/lib/utils';

// ===========================================
// Types
// ===========================================

export interface UPIQRCodeProps {
  /** UPI VPA */
  vpa: string;
  /** Payee name */
  name: string;
  /** Amount in rupees (optional for static QR) */
  amount?: number;
  /** Transaction note */
  note?: string;
  /** QR size in pixels */
  size?: number;
  /** Show amount below QR */
  showAmount?: boolean;
  /** QR expiry in minutes */
  expiryMinutes?: number;
  /** Callback when QR expires */
  onExpire?: () => void;
  /** Callback when payment is initiated */
  onPaymentInitiated?: (referenceId: string, uri: string) => void;
  /** Show app selection buttons */
  showAppButtons?: boolean;
  /** Additional className */
  className?: string;
}

// ===========================================
// Simple QR Code SVG Generator
// ===========================================

/**
 * Simple QR Code Matrix Generator
 * Uses a basic encoding for UPI URIs
 * For production, use a proper QR library like 'qrcode' or 'qrcode.react'
 */
function generateQRMatrix(data: string, size: number): string {
  // This is a placeholder - in production, use a proper QR library
  // For now, we'll create a visual placeholder with the UPI logo
  
  const cellSize = Math.floor(size / 25);
  const actualSize = cellSize * 25;
  
  // Create a simple pattern based on data hash
  const hash = data.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  
  // Generate SVG pattern (simplified - not a real QR code)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${actualSize} ${actualSize}" width="${size}" height="${size}">`;
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  
  // Add finder patterns (corner squares)
  const drawFinderPattern = (x: number, y: number) => {
    svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="black"/>`;
    svg += `<rect x="${(x + 1) * cellSize}" y="${(y + 1) * cellSize}" width="${5 * cellSize}" height="${5 * cellSize}" fill="white"/>`;
    svg += `<rect x="${(x + 2) * cellSize}" y="${(y + 2) * cellSize}" width="${3 * cellSize}" height="${3 * cellSize}" fill="black"/>`;
  };
  
  // Top-left
  drawFinderPattern(0, 0);
  // Top-right
  drawFinderPattern(18, 0);
  // Bottom-left
  drawFinderPattern(0, 18);
  
  // Add UPI text in center
  svg += `<rect x="${9 * cellSize}" y="${9 * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="white"/>`;
  svg += `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="${cellSize * 3}" font-weight="bold" fill="#00509d">UPI</text>`;
  
  // Add some pseudo-random modules based on hash
  const random = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < 25; col++) {
      // Skip finder patterns and center
      if ((row < 8 && col < 8) || 
          (row < 8 && col > 16) || 
          (row > 16 && col < 8) ||
          (row >= 9 && row <= 15 && col >= 9 && col <= 15)) {
        continue;
      }
      
      // Use hash to determine if cell should be filled
      if (random(hash + row * 25 + col) > 0.6) {
        svg += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  
  svg += `</svg>`;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ===========================================
// Countdown Hook
// ===========================================

function useCountdown(targetDate: Date | null, onExpire?: () => void) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      return;
    }
    
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - Date.now();
      return Math.max(0, Math.floor(difference / 1000));
    };
    
    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [targetDate, onExpire]);
  
  return timeLeft;
}

// ===========================================
// Component
// ===========================================

/**
 * UPIQRCode - Displays a UPI QR code for payments
 * 
 * @example
 * ```tsx
 * <UPIQRCode
 *   vpa="merchant@upi"
 *   name="My Shop"
 *   amount={500}
 *   note="Order #12345"
 *   onPaymentInitiated={(ref, uri) => console.log('Payment started:', ref)}
 * />
 * ```
 */
export const UPIQRCode: React.FC<UPIQRCodeProps> = ({
  vpa,
  name,
  amount,
  note,
  size = 256,
  showAmount = true,
  expiryMinutes = UPI_CONFIG.defaultExpiryMinutes,
  onExpire,
  onPaymentInitiated,
  showAppButtons = true,
  className,
}) => {
  // Generate transaction reference
  const referenceId = useMemo(() => generateTransactionRef(), []);
  
  // Generate UPI URI
  const upiDetails: UPIDetails = useMemo(() => ({
    vpa,
    name,
    amount,
    note,
    transactionRef: referenceId,
  }), [vpa, name, amount, note, referenceId]);
  
  const upiUri = useMemo(() => generateUPIUri(upiDetails), [upiDetails]);
  
  // Generate QR code
  const qrDataUrl = useMemo(() => generateQRMatrix(upiUri, size), [upiUri, size]);
  
  // Expiry date
  const expiryDate = useMemo(() => {
    if (expiryMinutes <= 0) return null;
    return new Date(Date.now() + expiryMinutes * 60 * 1000);
  }, [expiryMinutes]);
  
  // Countdown
  const [isExpired, setIsExpired] = useState(false);
  
  const handleExpire = useCallback(() => {
    setIsExpired(true);
    onExpire?.();
  }, [onExpire]);
  
  const timeLeft = useCountdown(expiryDate, handleExpire);
  
  // Check UPI availability
  const upiAvailable = useMemo(() => isUPIAvailable(), []);
  
  // Handle app button click
  const handleOpenApp = useCallback((appId?: string) => {
    const deepLink = appId 
      ? getUPIAppDeepLink(upiUri, appId as 'gpay' | 'phonepe' | 'paytm' | 'bhim')
      : upiUri;
    
    onPaymentInitiated?.(referenceId, deepLink);
    openUPIPayment(deepLink);
  }, [upiUri, referenceId, onPaymentInitiated]);
  
  // Format time left
  const formatTimeLeft = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Render expired state
  if (isExpired) {
    return (
      <div 
        className={cn(
          'flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-gray-800 rounded-lg',
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="text-4xl mb-2">⏰</div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">QR Code Expired</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Please refresh to generate a new QR code
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Refresh page to generate new QR code"
        >
          Refresh
        </button>
      </div>
    );
  }
  
  return (
    <div 
      className={cn(
        'flex flex-col items-center p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md',
        className
      )}
      role="region"
      aria-label="UPI Payment QR Code"
    >
      {/* QR Code */}
      <div className="relative">
        <img
          src={qrDataUrl}
          alt={`UPI QR Code to pay ${name}${amount ? ` ${formatINR(amount)}` : ''}`}
          width={size}
          height={size}
          className="rounded-md"
        />
        
        {/* Timer badge */}
        {timeLeft !== null && (
          <div 
            className={cn(
              'absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-medium',
              timeLeft > 60 
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
            )}
            aria-live="polite"
            aria-label={`QR code expires in ${formatTimeLeft(timeLeft)}`}
          >
            {formatTimeLeft(timeLeft)}
          </div>
        )}
      </div>
      
      {/* Payment Info */}
      <div className="mt-4 text-center">
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {name}
        </p>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {formatUPIIdForDisplay(vpa)}
        </p>
        
        {showAmount && amount !== undefined && amount > 0 && (
          <p 
            className="text-2xl font-bold text-gray-900 dark:text-white mt-2"
            aria-label={`Amount: ${formatINR(amount)}`}
          >
            {formatINR(amount, { showPaise: true })}
          </p>
        )}
        
        {note && (
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            {note}
          </p>
        )}
      </div>
      
      {/* Reference ID */}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span>Ref:</span>
        <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {referenceId}
        </code>
      </div>
      
      {/* App Buttons (Mobile only) */}
      {showAppButtons && upiAvailable && (
        <div className="mt-4 w-full">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">
            Or pay using
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {getUPIAppsList().slice(0, 4).map((app) => (
              <button
                key={app.id}
                onClick={() => handleOpenApp(app.id)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 
                  rounded-md text-sm hover:bg-gray-200 dark:hover:bg-gray-700
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Pay using ${app.name}`}
              >
                <span>{app.icon}</span>
                <span className="hidden sm:inline">{app.name}</span>
              </button>
            ))}
          </div>
          
          {/* Generic Pay Button */}
          <button
            onClick={() => handleOpenApp()}
            className="mt-3 w-full py-3 bg-blue-600 text-white rounded-lg font-medium
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Open UPI payment app"
          >
            Pay with UPI
          </button>
        </div>
      )}
      
      {/* Instructions (Desktop) */}
      {!upiAvailable && (
        <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Scan this QR code with any UPI app</p>
          <p className="text-xs mt-1">(Google Pay, PhonePe, Paytm, etc.)</p>
        </div>
      )}
      
      {/* Accessibility: Copy UPI ID */}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(vpa);
        }}
        className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline
          focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        aria-label={`Copy UPI ID: ${vpa}`}
      >
        Copy UPI ID
      </button>
    </div>
  );
};

// ===========================================
// Static QR Code Variant
// ===========================================

export interface StaticUPIQRProps {
  /** UPI VPA */
  vpa: string;
  /** Display name */
  name: string;
  /** QR size */
  size?: number;
  /** Additional className */
  className?: string;
}

/**
 * StaticUPIQR - A simple static UPI QR code (no amount, no expiry)
 */
export const StaticUPIQR: React.FC<StaticUPIQRProps> = ({
  vpa,
  name,
  size = 200,
  className,
}) => {
  return (
    <UPIQRCode
      vpa={vpa}
      name={name}
      size={size}
      showAmount={false}
      showAppButtons={false}
      expiryMinutes={0}
      className={className}
    />
  );
};

export default UPIQRCode;
