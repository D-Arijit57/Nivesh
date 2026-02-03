/**
 * Indian Currency (INR) Formatting Utilities
 * 
 * Provides formatting functions for Indian Rupee amounts
 * including lakhs/crores notation and various display formats.
 * 
 * @module lib/currency
 */

// ===========================================
// Types
// ===========================================

/**
 * Currency formatting options
 */
export interface INRFormatOptions {
  /** Show paise (decimal places) */
  showPaise?: boolean;
  /** Use compact notation (lakhs/crores) for large amounts */
  compact?: boolean;
  /** Show sign for positive/negative amounts */
  showSign?: boolean;
  /** Use words instead of numbers for compact */
  useWords?: boolean;
  /** Locale for number formatting */
  locale?: 'en-IN' | 'hi-IN';
}

/**
 * Parsed amount with unit
 */
interface ParsedAmount {
  value: number;
  unit: '' | 'K' | 'L' | 'Cr';
  unitWord: '' | 'Thousand' | 'Lakh' | 'Crore';
  unitWordHindi: '' | 'हज़ार' | 'लाख' | 'करोड़';
}

// ===========================================
// Constants
// ===========================================

/** INR currency symbol */
export const INR_SYMBOL = '₹';

/** Conversion factors */
export const LAKH = 100000;
export const CRORE = 10000000;
export const THOUSAND = 1000;

// ===========================================
// Core Formatting Functions
// ===========================================

/**
 * Formats a number in Indian numbering system (lakhs, crores)
 * Uses the standard Indian grouping: XX,XX,XXX
 * 
 * @param amount - Amount in paise or rupees
 * @param options - Formatting options
 * @returns Formatted currency string
 * 
 * @example
 * formatINR(1234567) // "₹12,34,567"
 * formatINR(1234567, { showPaise: true }) // "₹12,34,567.00"
 * formatINR(10000000, { compact: true }) // "₹1 Cr"
 */
export const formatINR = (
  amount: number,
  options: INRFormatOptions = {}
): string => {
  const {
    showPaise = false,
    compact = false,
    showSign = false,
    useWords = false,
    locale = 'en-IN',
  } = options;
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  let formattedAmount: string;
  
  if (compact && absAmount >= THOUSAND) {
    const parsed = parseAmountToUnits(absAmount);
    
    if (useWords) {
      const unitWord = locale === 'hi-IN' ? parsed.unitWordHindi : parsed.unitWord;
      formattedAmount = `${formatNumber(parsed.value, locale, showPaise)} ${unitWord}`;
    } else {
      formattedAmount = `${formatNumber(parsed.value, locale, showPaise)} ${parsed.unit}`;
    }
  } else {
    formattedAmount = formatNumber(absAmount, locale, showPaise);
  }
  
  // Build final string
  let result = INR_SYMBOL;
  
  if (showSign && !isNegative) {
    result = '+' + result;
  } else if (isNegative) {
    result = '-' + result;
  }
  
  result += formattedAmount;
  
  return result;
};

/**
 * Formats amount from paise to rupees with proper formatting
 * 
 * @param paise - Amount in paise
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export const formatPaiseToINR = (
  paise: number,
  options: INRFormatOptions = {}
): string => {
  const rupees = paise / 100;
  return formatINR(rupees, { showPaise: true, ...options });
};

/**
 * Converts rupees to paise
 * 
 * @param rupees - Amount in rupees
 * @returns Amount in paise
 */
export const rupeesToPaise = (rupees: number): number => {
  return Math.round(rupees * 100);
};

/**
 * Converts paise to rupees
 * 
 * @param paise - Amount in paise
 * @returns Amount in rupees
 */
export const paiseToRupees = (paise: number): number => {
  return paise / 100;
};

// ===========================================
// Parsing Functions
// ===========================================

/**
 * Parses amount into value and unit
 * 
 * @param amount - Amount in rupees
 * @returns Parsed amount with unit
 */
export const parseAmountToUnits = (amount: number): ParsedAmount => {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= CRORE) {
    return {
      value: absAmount / CRORE,
      unit: 'Cr',
      unitWord: 'Crore',
      unitWordHindi: 'करोड़',
    };
  }
  
  if (absAmount >= LAKH) {
    return {
      value: absAmount / LAKH,
      unit: 'L',
      unitWord: 'Lakh',
      unitWordHindi: 'लाख',
    };
  }
  
  if (absAmount >= THOUSAND) {
    return {
      value: absAmount / THOUSAND,
      unit: 'K',
      unitWord: 'Thousand',
      unitWordHindi: 'हज़ार',
    };
  }
  
  return {
    value: absAmount,
    unit: '',
    unitWord: '',
    unitWordHindi: '',
  };
};

/**
 * Parses a formatted INR string to number
 * Handles various formats: ₹1,23,456 | 1.5L | 2Cr
 * 
 * @param formatted - Formatted currency string
 * @returns Amount in rupees
 */
export const parseINR = (formatted: string): number => {
  // Remove currency symbol and whitespace
  let cleaned = formatted.replace(/[₹\s,]/g, '');
  
  // Check for unit suffixes
  const croreMatch = cleaned.match(/^([\d.]+)\s*(Cr|cr|crore|करोड़)$/i);
  if (croreMatch) {
    return parseFloat(croreMatch[1]) * CRORE;
  }
  
  const lakhMatch = cleaned.match(/^([\d.]+)\s*(L|lakh|lac|लाख)$/i);
  if (lakhMatch) {
    return parseFloat(lakhMatch[1]) * LAKH;
  }
  
  const thousandMatch = cleaned.match(/^([\d.]+)\s*(K|thousand|हज़ार)$/i);
  if (thousandMatch) {
    return parseFloat(thousandMatch[1]) * THOUSAND;
  }
  
  // Plain number
  return parseFloat(cleaned) || 0;
};

// ===========================================
// Display Helpers
// ===========================================

/**
 * Formats amount for display with appropriate precision
 * Shows 2 decimal places for small amounts, none for large
 * 
 * @param amount - Amount in rupees
 * @returns Formatted string
 */
export const formatAmountForDisplay = (amount: number): string => {
  const absAmount = Math.abs(amount);
  
  // Large amounts: no decimals, compact
  if (absAmount >= LAKH) {
    return formatINR(amount, { compact: true, useWords: true });
  }
  
  // Medium amounts: no decimals
  if (absAmount >= 100) {
    return formatINR(amount);
  }
  
  // Small amounts: show paise
  return formatINR(amount, { showPaise: true });
};

/**
 * Formats amount for input field (no symbol, with commas)
 * 
 * @param amount - Amount in rupees
 * @returns Formatted number string
 */
export const formatAmountForInput = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * Formats transaction amount with sign
 * Positive = credit (green), Negative = debit (red)
 * 
 * @param amount - Amount in rupees (positive = credit, negative = debit)
 * @returns Object with formatted amount and type
 */
export const formatTransactionAmount = (amount: number): {
  formatted: string;
  type: 'credit' | 'debit';
  className: string;
} => {
  const isCredit = amount >= 0;
  
  return {
    formatted: formatINR(Math.abs(amount), { showPaise: true }),
    type: isCredit ? 'credit' : 'debit',
    className: isCredit ? 'text-green-600' : 'text-red-600',
  };
};

// ===========================================
// Internal Helpers
// ===========================================

/**
 * Formats number with Indian locale
 */
function formatNumber(
  value: number,
  locale: 'en-IN' | 'hi-IN',
  showDecimals: boolean
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 2,
  }).format(value);
}

// ===========================================
// Amount Input Helpers
// ===========================================

/**
 * Handles amount input formatting in real-time
 * Call this on input change for INR amount fields
 * 
 * @param input - Raw input string
 * @returns Cleaned and formatted input
 */
export const handleAmountInput = (input: string): {
  display: string;  // For input display
  value: number;    // Parsed number value
} => {
  // Remove non-numeric except decimal
  const cleaned = input.replace(/[^\d.]/g, '');
  
  // Handle multiple decimals
  const parts = cleaned.split('.');
  let sanitized = parts[0];
  if (parts.length > 1) {
    sanitized += '.' + parts[1].slice(0, 2); // Max 2 decimal places
  }
  
  const value = parseFloat(sanitized) || 0;
  
  // Format for display (add commas)
  const display = sanitized
    ? formatAmountForInput(value)
    : '';
  
  return { display, value };
};

/**
 * Validates amount against limits
 * 
 * @param amount - Amount in rupees
 * @param min - Minimum amount
 * @param max - Maximum amount
 * @returns Validation result
 */
export const validateAmount = (
  amount: number,
  min: number = 1,
  max: number = Infinity
): { valid: boolean; error?: string } => {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Please enter a valid amount' };
  }
  
  if (amount < min) {
    return { 
      valid: false, 
      error: `Minimum amount is ${formatINR(min)}` 
    };
  }
  
  if (amount > max) {
    return { 
      valid: false, 
      error: `Maximum amount is ${formatINR(max)}` 
    };
  }
  
  return { valid: true };
};

// ===========================================
// Accessibility Helpers
// ===========================================

/**
 * Gets screen reader friendly amount description
 * 
 * @param amount - Amount in rupees
 * @returns Screen reader text
 */
export const getAmountAriaLabel = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const parsed = parseAmountToUnits(absAmount);
  
  let text = '';
  
  if (amount < 0) {
    text = 'minus ';
  }
  
  if (parsed.unit) {
    text += `${parsed.value.toFixed(2)} ${parsed.unitWord} rupees`;
  } else {
    const rupees = Math.floor(absAmount);
    const paise = Math.round((absAmount - rupees) * 100);
    
    text += `${rupees} rupees`;
    if (paise > 0) {
      text += ` and ${paise} paise`;
    }
  }
  
  return text;
};
