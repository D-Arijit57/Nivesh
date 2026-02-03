/**
 * Currency Display Component
 * 
 * Accessible component for displaying INR amounts
 * with proper formatting and screen reader support.
 * 
 * @module components/CurrencyDisplay
 */

'use client';

import React from 'react';
import { 
  formatINR, 
  formatPaiseToINR,
  getAmountAriaLabel,
  INRFormatOptions 
} from '@/lib/currency';
import { cn } from '@/lib/utils';

// ===========================================
// Types
// ===========================================

export interface CurrencyDisplayProps {
  /** Amount in rupees (default) or paise */
  amount: number;
  /** Whether amount is in paise */
  inPaise?: boolean;
  /** Show as credit (positive/green) or debit (negative/red) */
  type?: 'credit' | 'debit' | 'neutral';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
  /** Formatting options */
  formatOptions?: INRFormatOptions;
  /** Show +/- sign */
  showSign?: boolean;
  /** Custom aria-label */
  ariaLabel?: string;
}

// ===========================================
// Size Styles
// ===========================================

const sizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg font-medium',
  xl: 'text-2xl font-semibold',
};

const typeStyles = {
  credit: 'text-green-600 dark:text-green-400',
  debit: 'text-red-600 dark:text-red-400',
  neutral: 'text-gray-900 dark:text-gray-100',
};

// ===========================================
// Component
// ===========================================

/**
 * CurrencyDisplay - Displays formatted INR amounts
 * 
 * @example
 * ```tsx
 * <CurrencyDisplay amount={150000} />
 * <CurrencyDisplay amount={150000} size="xl" />
 * <CurrencyDisplay amount={-5000} type="debit" showSign />
 * <CurrencyDisplay amount={50000000} formatOptions={{ compact: true }} />
 * ```
 */
export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  inPaise = false,
  type = 'neutral',
  size = 'md',
  className,
  formatOptions = {},
  showSign = false,
  ariaLabel,
}) => {
  // Convert paise to rupees if needed
  const rupeesAmount = inPaise ? amount / 100 : amount;
  
  // Determine type from amount if not specified
  const effectiveType = type !== 'neutral' 
    ? type 
    : (rupeesAmount >= 0 ? 'credit' : 'debit');
  
  // Format the amount
  const formattedAmount = inPaise
    ? formatPaiseToINR(amount, { showSign, ...formatOptions })
    : formatINR(rupeesAmount, { showSign, ...formatOptions });
  
  // Generate aria label
  const effectiveAriaLabel = ariaLabel || getAmountAriaLabel(rupeesAmount);
  
  return (
    <span
      className={cn(
        sizeStyles[size],
        type !== 'neutral' && typeStyles[effectiveType],
        'tabular-nums',
        className
      )}
      aria-label={effectiveAriaLabel}
      role="text"
    >
      {formattedAmount}
    </span>
  );
};

// ===========================================
// Balance Display Variant
// ===========================================

export interface BalanceDisplayProps {
  /** Current balance in rupees */
  balance: number;
  /** Available balance (if different) */
  availableBalance?: number;
  /** Show compact format for large amounts */
  compact?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
}

/**
 * BalanceDisplay - Displays account balance with optional available balance
 */
export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  availableBalance,
  compact = false,
  size = 'lg',
  className,
}) => {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-baseline gap-1">
        <span className="text-gray-500 dark:text-gray-400 text-sm">
          Balance
        </span>
      </div>
      <CurrencyDisplay
        amount={balance}
        size={size}
        formatOptions={{ compact, showPaise: !compact }}
        ariaLabel={`Account balance: ${getAmountAriaLabel(balance)}`}
      />
      {availableBalance !== undefined && availableBalance !== balance && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            Available:
          </span>
          <CurrencyDisplay
            amount={availableBalance}
            size="sm"
            className="text-gray-600 dark:text-gray-300"
            formatOptions={{ compact }}
          />
        </div>
      )}
    </div>
  );
};

// ===========================================
// Transaction Amount Variant
// ===========================================

export interface TransactionAmountProps {
  /** Amount in rupees */
  amount: number;
  /** Transaction type */
  isCredit: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

/**
 * TransactionAmount - Displays transaction amounts with credit/debit styling
 */
export const TransactionAmount: React.FC<TransactionAmountProps> = ({
  amount,
  isCredit,
  size = 'md',
  className,
}) => {
  const sign = isCredit ? '+' : '-';
  
  return (
    <span
      className={cn(
        sizeStyles[size],
        isCredit ? typeStyles.credit : typeStyles.debit,
        'tabular-nums font-medium',
        className
      )}
      aria-label={`${isCredit ? 'Credit' : 'Debit'} of ${getAmountAriaLabel(amount)}`}
      role="text"
    >
      {sign}
      {formatINR(Math.abs(amount), { showPaise: true })}
    </span>
  );
};

// ===========================================
// Animated Counter (for totals)
// ===========================================

export interface AnimatedCurrencyProps {
  /** Target amount */
  amount: number;
  /** Animation duration in ms */
  duration?: number;
  /** Formatting options */
  formatOptions?: INRFormatOptions;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
}

/**
 * AnimatedCurrency - Animated counter for currency amounts
 */
export const AnimatedCurrency: React.FC<AnimatedCurrencyProps> = ({
  amount,
  duration = 1000,
  formatOptions = {},
  size = 'xl',
  className,
}) => {
  const [displayAmount, setDisplayAmount] = React.useState(0);
  const prevAmountRef = React.useRef(0);
  
  React.useEffect(() => {
    const startTime = Date.now();
    const startAmount = prevAmountRef.current;
    const diff = amount - startAmount;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startAmount + diff * easeProgress;
      
      setDisplayAmount(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevAmountRef.current = amount;
      }
    };
    
    requestAnimationFrame(animate);
  }, [amount, duration]);
  
  return (
    <CurrencyDisplay
      amount={displayAmount}
      size={size}
      formatOptions={formatOptions}
      className={className}
      ariaLabel={getAmountAriaLabel(amount)} // Use final amount for a11y
    />
  );
};

export default CurrencyDisplay;
