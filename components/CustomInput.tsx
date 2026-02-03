import React from 'react'
import { FormControl, FormField, FormLabel, FormMessage } from './ui/form'
import { Input } from './ui/input'

import { Control, FieldPath } from 'react-hook-form'
import { z } from 'zod'
import { authFormSchema } from '@/lib/utils'

const formSchema = authFormSchema('sign-up')

interface CustomInput {
  control: Control<z.infer<typeof formSchema>>,
  name: FieldPath<z.infer<typeof formSchema>>,
  label: string,
  placeholder: string
}

// ===========================================
// Date Formatting (DD-MM-YYYY Indian Format)
// ===========================================

// Auto-format date as DD-MM-YYYY (Indian format)
const formatDateInput = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Format as DD-MM-YYYY
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  } else {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
  }
};

// Convert DD-MM-YYYY to YYYY-MM-DD for API
const convertToAPIFormat = (indianDate: string): string => {
  const parts = indianDate.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  return indianDate;
};

// ===========================================
// Phone Number Formatting (+91)
// ===========================================

// Auto-format Indian phone number with +91
const formatPhoneInput = (value: string): string => {
  // Remove all non-digits
  let digits = value.replace(/\D/g, '');
  
  // Remove leading 91 if user types it (we'll add +91 prefix)
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  
  // Limit to 10 digits
  digits = digits.slice(0, 10);
  
  // Format as +91 XXXXX XXXXX
  if (digits.length === 0) {
    return '';
  } else if (digits.length <= 5) {
    return `+91 ${digits}`;
  } else {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
};

// Get raw phone number for API (just digits with country code)
const getPhoneForAPI = (formattedPhone: string): string => {
  const digits = formattedPhone.replace(/\D/g, '');
  // Ensure it starts with 91
  if (digits.startsWith('91')) {
    return `+${digits}`;
  }
  return `+91${digits}`;
};

// ===========================================
// PAN Number Formatting (ABCDE1234F)
// ===========================================

/**
 * Format PAN number: 5 letters, 4 digits, 1 letter
 * Auto-capitalizes letters
 */
const formatPANInput = (value: string): string => {
  // Remove spaces and convert to uppercase
  const cleaned = value.replace(/\s/g, '').toUpperCase();
  
  // PAN format: AAAAA0000A
  let result = '';
  for (let i = 0; i < cleaned.length && i < 10; i++) {
    const char = cleaned[i];
    if (i < 5) {
      // First 5 characters must be letters
      if (/[A-Z]/.test(char)) result += char;
    } else if (i < 9) {
      // Next 4 characters must be digits
      if (/\d/.test(char)) result += char;
    } else {
      // Last character must be a letter
      if (/[A-Z]/.test(char)) result += char;
    }
  }
  
  return result;
};

// ===========================================
// Aadhaar Number Formatting (XXXX XXXX XXXX)
// ===========================================

/**
 * Format Aadhaar number: 12 digits with spaces
 * Format: XXXX XXXX XXXX
 */
const formatAadhaarInput = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '').slice(0, 12);
  
  // Format as XXXX XXXX XXXX
  if (digits.length <= 4) {
    return digits;
  } else if (digits.length <= 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  } else {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }
};

/**
 * Get raw Aadhaar for API (just digits)
 */
const getAadhaarForAPI = (formattedAadhaar: string): string => {
  return formattedAadhaar.replace(/\D/g, '');
};

// ===========================================
// UPI ID Formatting (name@bank)
// ===========================================

/**
 * Format UPI ID: lowercase, allow alphanumeric, dots, hyphens, and @
 * No spaces, auto-lowercase
 */
const formatUPIInput = (value: string): string => {
  // Remove spaces, convert to lowercase
  return value.replace(/\s/g, '').toLowerCase();
};

// ===========================================
// IFSC Code Formatting (ABCD0123456)
// ===========================================

/**
 * Format IFSC code: 4 letters, 0, 6 alphanumeric
 * Auto-capitalizes
 */
const formatIFSCInput = (value: string): string => {
  // Remove spaces and convert to uppercase
  const cleaned = value.replace(/\s/g, '').toUpperCase();
  
  // IFSC format: AAAA0NNNNNN (4 letters, 0, 6 alphanumeric)
  let result = '';
  for (let i = 0; i < cleaned.length && i < 11; i++) {
    const char = cleaned[i];
    if (i < 4) {
      // First 4 characters must be letters
      if (/[A-Z]/.test(char)) result += char;
    } else if (i === 4) {
      // 5th character must be 0
      if (char === '0') result += char;
    } else {
      // Last 6 characters are alphanumeric
      if (/[A-Z0-9]/.test(char)) result += char;
    }
  }
  
  return result;
};

// ===========================================
// PIN Code (Postal Code) Formatting
// ===========================================

/**
 * Format Indian postal code: 6 digits
 * First digit cannot be 0
 */
const formatPinCodeInput = (value: string): string => {
  // Remove all non-digits
  let digits = value.replace(/\D/g, '');
  
  // First digit cannot be 0
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  
  // Limit to 6 digits
  return digits.slice(0, 6);
};

// ===========================================
// OTP Formatting (6 digits)
// ===========================================

/**
 * Format OTP: 6 digits only
 */
const formatOTPInput = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 6);
};

// ===========================================
// Account Number Formatting
// ===========================================

/**
 * Format bank account number: digits only, 9-18 digits
 */
const formatAccountNumberInput = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 18);
};

// ===========================================
// Field Configuration
// ===========================================

type FieldConfig = {
  formatter?: (value: string) => string;
  placeholder: string;
  maxLength?: number;
  inputType: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
};

/**
 * Get configuration for each field type
 */
const getFieldConfig = (name: string, defaultPlaceholder: string): FieldConfig => {
  const configs: Record<string, FieldConfig> = {
    dateOfBirth: {
      formatter: formatDateInput,
      placeholder: 'DD-MM-YYYY',
      maxLength: 10,
      inputType: 'text',
      inputMode: 'numeric',
    },
    phone: {
      formatter: formatPhoneInput,
      placeholder: '+91 XXXXX XXXXX',
      maxLength: 16,
      inputType: 'tel',
      inputMode: 'tel',
    },
    pan: {
      formatter: formatPANInput,
      placeholder: 'ABCDE1234F',
      maxLength: 10,
      inputType: 'text',
    },
    aadhaar: {
      formatter: formatAadhaarInput,
      placeholder: 'XXXX XXXX XXXX',
      maxLength: 14,
      inputType: 'text',
      inputMode: 'numeric',
    },
    upiId: {
      formatter: formatUPIInput,
      placeholder: 'yourname@upi',
      maxLength: 50,
      inputType: 'text',
    },
    ifscCode: {
      formatter: formatIFSCInput,
      placeholder: 'ABCD0123456',
      maxLength: 11,
      inputType: 'text',
    },
    postalCode: {
      formatter: formatPinCodeInput,
      placeholder: '123456',
      maxLength: 6,
      inputType: 'text',
      inputMode: 'numeric',
    },
    otp: {
      formatter: formatOTPInput,
      placeholder: '123456',
      maxLength: 6,
      inputType: 'text',
      inputMode: 'numeric',
    },
    accountNumber: {
      formatter: formatAccountNumberInput,
      placeholder: 'Account Number',
      maxLength: 18,
      inputType: 'text',
      inputMode: 'numeric',
    },
    email: {
      placeholder: 'Enter your email',
      inputType: 'email',
      inputMode: 'email',
    },
    password: {
      placeholder: 'Enter your password',
      inputType: 'password',
    },
  };

  return configs[name] || {
    placeholder: defaultPlaceholder,
    inputType: 'text',
  };
};

const CustomInput = ({ control, name, label, placeholder }: CustomInput) => {
  const config = getFieldConfig(name, placeholder);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <div className="form-item">
          <FormLabel className="form-label">
            {label}
          </FormLabel>
          <div className="flex w-full flex-col">
            <FormControl>
              <Input 
                placeholder={config.placeholder}
                className="input-class"
                type={config.inputType}
                inputMode={config.inputMode}
                maxLength={config.maxLength}
                {...field}
                value={field.value || ''}
                onChange={(e) => {
                  if (config.formatter) {
                    const formatted = config.formatter(e.target.value);
                    field.onChange(formatted);
                  } else {
                    field.onChange(e.target.value);
                  }
                }}
              />
            </FormControl>
            <FormMessage className="form-message mt-2" />
          </div>
        </div>
      )}
    />
  )
}

// Export utility functions for use in other components
export { 
  convertToAPIFormat,
  getPhoneForAPI,
  getAadhaarForAPI,
  formatPANInput,
  formatAadhaarInput,
  formatUPIInput,
  formatIFSCInput,
  formatPinCodeInput,
  formatOTPInput,
};

export default CustomInput