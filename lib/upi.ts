/**
 * UPI QR Code Payment Module
 * 
 * Generates UPI QR codes and deep links for payments.
 * Supports both static and dynamic QR codes with transaction details.
 * 
 * @module lib/upi
 */

import { formatINR } from './currency';

// ===========================================
// Types
// ===========================================

export interface UPIDetails {
  /** UPI VPA (Virtual Payment Address) e.g., name@upi */
  vpa: string;
  /** Payee/Merchant name */
  name: string;
  /** Amount in rupees */
  amount?: number;
  /** Transaction reference ID */
  transactionRef?: string;
  /** Transaction note/description */
  note?: string;
  /** Merchant code (for businesses) */
  merchantCode?: string;
  /** Currency (default: INR) */
  currency?: string;
  /** URL for more details */
  url?: string;
}

export interface QRGenerationOptions {
  /** QR code size in pixels */
  size?: number;
  /** Error correction level */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  /** Include amount in QR */
  includeAmount?: boolean;
  /** QR expiry time in minutes */
  expiryMinutes?: number;
}

export interface UPIQRData {
  /** UPI URI string */
  uri: string;
  /** QR code data URL (base64 PNG) */
  qrDataUrl: string | null;
  /** Expiry timestamp */
  expiresAt: Date | null;
  /** Formatted amount for display */
  displayAmount: string;
  /** Reference ID */
  referenceId: string;
}

export interface UPIValidation {
  isValid: boolean;
  vpa?: string;
  name?: string;
  error?: string;
}

// ===========================================
// Constants
// ===========================================

export const UPI_CONFIG = {
  /** UPI URL scheme */
  scheme: 'upi://pay',
  /** Default currency */
  defaultCurrency: 'INR',
  /** QR default size */
  defaultQRSize: 256,
  /** QR default error correction */
  defaultErrorCorrection: 'M' as const,
  /** Default QR expiry (15 minutes) */
  defaultExpiryMinutes: 15,
  /** UPI ID regex pattern */
  upiIdPattern: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/,
  /** Popular UPI handles */
  popularHandles: [
    'paytm',
    'phonepe',
    'gpay',
    'ybl', // PhonePe
    'ibl', // ICICI Bank
    'sbi', // SBI
    'oksbi',
    'okaxis',
    'okhdfcbank',
    'okicici',
    'apl', // Amazon Pay
    'upi',
  ],
};

// ===========================================
// UPI URI Generation
// ===========================================

/**
 * Generate UPI payment URI
 * 
 * @param details - UPI payment details
 * @returns UPI URI string
 * 
 * @example
 * ```ts
 * const uri = generateUPIUri({
 *   vpa: 'merchant@upi',
 *   name: 'Merchant Name',
 *   amount: 500,
 *   note: 'Order #12345',
 * });
 * // "upi://pay?pa=merchant@upi&pn=Merchant%20Name&am=500&cu=INR&tn=Order%20%2312345"
 * ```
 */
export function generateUPIUri(details: UPIDetails): string {
  const params = new URLSearchParams();
  
  // Required: Payee VPA
  params.set('pa', details.vpa);
  
  // Required: Payee Name
  params.set('pn', details.name);
  
  // Optional: Amount
  if (details.amount !== undefined && details.amount > 0) {
    params.set('am', details.amount.toFixed(2));
  }
  
  // Currency (default INR)
  params.set('cu', details.currency || UPI_CONFIG.defaultCurrency);
  
  // Optional: Transaction Reference
  if (details.transactionRef) {
    params.set('tr', details.transactionRef);
  }
  
  // Optional: Transaction Note
  if (details.note) {
    params.set('tn', details.note);
  }
  
  // Optional: Merchant Code
  if (details.merchantCode) {
    params.set('mc', details.merchantCode);
  }
  
  // Optional: URL
  if (details.url) {
    params.set('url', details.url);
  }
  
  return `${UPI_CONFIG.scheme}?${params.toString()}`;
}

/**
 * Generate a unique transaction reference ID
 */
export function generateTransactionRef(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN${timestamp}${random}`.toUpperCase();
}

// ===========================================
// UPI Validation
// ===========================================

/**
 * Validate UPI ID format
 * 
 * @param upiId - UPI VPA to validate
 * @returns Validation result
 * 
 * @example
 * ```ts
 * validateUPIId('john@paytm'); // { isValid: true, vpa: 'john@paytm', ... }
 * validateUPIId('invalid'); // { isValid: false, error: '...' }
 * ```
 */
export function validateUPIId(upiId: string): UPIValidation {
  if (!upiId || typeof upiId !== 'string') {
    return {
      isValid: false,
      error: 'UPI ID is required',
    };
  }
  
  const trimmed = upiId.trim().toLowerCase();
  
  // Check format
  if (!UPI_CONFIG.upiIdPattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid UPI ID format. Use format: name@handle',
    };
  }
  
  // Check minimum length
  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: 'UPI ID is too short',
    };
  }
  
  // Check maximum length
  if (trimmed.length > 50) {
    return {
      isValid: false,
      error: 'UPI ID is too long',
    };
  }
  
  // Extract parts
  const [username, handle] = trimmed.split('@');
  
  // Validate username part
  if (username.length < 2) {
    return {
      isValid: false,
      error: 'UPI ID username is too short',
    };
  }
  
  // Check if handle is valid (optional strict check)
  // const isKnownHandle = UPI_CONFIG.popularHandles.includes(handle);
  
  return {
    isValid: true,
    vpa: trimmed,
  };
}

/**
 * Extract name from UPI ID (for display)
 */
export function extractNameFromUPI(upiId: string): string {
  const result = validateUPIId(upiId);
  if (!result.isValid || !result.vpa) {
    return 'Unknown';
  }
  
  const [username] = result.vpa.split('@');
  
  // Convert username to display name
  return username
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ===========================================
// QR Code Generation (Server-side with external lib)
// ===========================================

/**
 * Generate QR code data for UPI payment
 * 
 * This function generates the UPI URI and QR metadata.
 * The actual QR code image should be generated using a QR library
 * (e.g., qrcode.react on client, qr-image on server).
 * 
 * @param details - UPI payment details
 * @param options - QR generation options
 * @returns UPI QR data
 * 
 * @example
 * ```ts
 * const qrData = await generateUPIQRData({
 *   vpa: 'merchant@upi',
 *   name: 'My Shop',
 *   amount: 1000,
 * });
 * // Use qrData.uri with a QR code component
 * ```
 */
export async function generateUPIQRData(
  details: UPIDetails,
  options: QRGenerationOptions = {}
): Promise<UPIQRData> {
  const {
    includeAmount = true,
    expiryMinutes = UPI_CONFIG.defaultExpiryMinutes,
  } = options;
  
  // Generate reference if not provided
  const referenceId = details.transactionRef || generateTransactionRef();
  
  // Create UPI details with reference
  const upiDetails: UPIDetails = {
    ...details,
    transactionRef: referenceId,
    amount: includeAmount ? details.amount : undefined,
  };
  
  // Generate URI
  const uri = generateUPIUri(upiDetails);
  
  // Calculate expiry
  const expiresAt = expiryMinutes > 0
    ? new Date(Date.now() + expiryMinutes * 60 * 1000)
    : null;
  
  // Format display amount
  const displayAmount = details.amount 
    ? formatINR(details.amount, { showPaise: true })
    : '₹0.00';
  
  return {
    uri,
    qrDataUrl: null, // Client should use a QR library
    expiresAt,
    displayAmount,
    referenceId,
  };
}

// ===========================================
// UPI Deep Links
// ===========================================

/**
 * Generate UPI app intent URL for specific apps
 * 
 * @param uri - UPI URI
 * @param app - Target app name
 * @returns App-specific deep link or generic UPI URI
 */
export function getUPIAppDeepLink(
  uri: string,
  app?: 'gpay' | 'phonepe' | 'paytm' | 'bhim'
): string {
  // Base UPI URI works for all apps
  // Some apps have specific schemes, but standard upi:// works universally
  switch (app) {
    case 'gpay':
      // Google Pay uses tez:// but also supports upi://
      return uri.replace('upi://', 'tez://');
    case 'phonepe':
      // PhonePe uses phonepe:// scheme
      return uri.replace('upi://', 'phonepe://');
    case 'paytm':
      // Paytm uses paytmmp:// scheme
      return uri.replace('upi://', 'paytmmp://');
    case 'bhim':
      // BHIM uses upi:// standard
      return uri;
    default:
      // Standard UPI URI - works with any UPI app
      return uri;
  }
}

/**
 * Check if UPI is available on the device
 * (Client-side only)
 */
export function isUPIAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check for mobile device
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  return isMobile;
}

/**
 * Open UPI payment in default app
 * (Client-side only)
 */
export function openUPIPayment(uri: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Try to open in app
  window.location.href = uri;
}

// ===========================================
// Payment Verification
// ===========================================

export interface PaymentVerificationParams {
  referenceId: string;
  expectedAmount: number;
  maxWaitTime?: number; // milliseconds
}

/**
 * Create a webhook URL for payment verification
 * 
 * This should be used in conjunction with your payment gateway's
 * webhook to verify UPI payment completion.
 */
export function createPaymentVerificationParams(
  details: UPIDetails & { transactionRef: string }
): PaymentVerificationParams {
  return {
    referenceId: details.transactionRef,
    expectedAmount: details.amount || 0,
    maxWaitTime: 10 * 60 * 1000, // 10 minutes default
  };
}

// ===========================================
// QR Code Component Props (for React)
// ===========================================

export interface UPIQRCodeProps {
  /** UPI VPA */
  vpa: string;
  /** Payee name */
  name: string;
  /** Amount (optional for static QR) */
  amount?: number;
  /** Transaction note */
  note?: string;
  /** QR size in pixels */
  size?: number;
  /** Show amount below QR */
  showAmount?: boolean;
  /** Callback when QR expires */
  onExpire?: () => void;
  /** Callback when payment is initiated */
  onPaymentInitiated?: (uri: string) => void;
  /** Additional className */
  className?: string;
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Parse UPI URI back to details
 */
export function parseUPIUri(uri: string): Partial<UPIDetails> | null {
  try {
    if (!uri.startsWith('upi://pay?')) {
      return null;
    }
    
    const url = new URL(uri);
    const params = url.searchParams;
    
    return {
      vpa: params.get('pa') || undefined,
      name: params.get('pn') || undefined,
      amount: params.has('am') ? parseFloat(params.get('am')!) : undefined,
      currency: params.get('cu') || 'INR',
      transactionRef: params.get('tr') || undefined,
      note: params.get('tn') || undefined,
      merchantCode: params.get('mc') || undefined,
      url: params.get('url') || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Format UPI ID for display (mask middle part)
 */
export function formatUPIIdForDisplay(upiId: string): string {
  const result = validateUPIId(upiId);
  if (!result.isValid || !result.vpa) {
    return upiId;
  }
  
  const [username, handle] = result.vpa.split('@');
  
  if (username.length <= 4) {
    return result.vpa;
  }
  
  const masked = username.slice(0, 2) + '***' + username.slice(-2);
  return `${masked}@${handle}`;
}

/**
 * Get list of popular UPI apps
 */
export function getUPIAppsList(): Array<{
  id: string;
  name: string;
  icon: string;
  scheme: string;
}> {
  return [
    { id: 'gpay', name: 'Google Pay', icon: '💳', scheme: 'tez://' },
    { id: 'phonepe', name: 'PhonePe', icon: '📱', scheme: 'phonepe://' },
    { id: 'paytm', name: 'Paytm', icon: '💰', scheme: 'paytmmp://' },
    { id: 'bhim', name: 'BHIM', icon: '🏦', scheme: 'upi://' },
    { id: 'amazonpay', name: 'Amazon Pay', icon: '🛒', scheme: 'amzn://' },
  ];
}
