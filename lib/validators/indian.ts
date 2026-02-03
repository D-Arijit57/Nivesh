/**
 * Indian Format Validators
 * Zod schemas for PAN, Aadhaar, UPI, IFSC, Phone, PIN Code, and States
 * 
 * @module lib/validators/indian
 */

import { z } from 'zod';

// ===========================================
// PAN (Permanent Account Number)
// ===========================================
// Format: 5 letters + 4 digits + 1 letter
// Example: ABCDE1234F
// 4th character indicates holder type:
// P - Individual, C - Company, H - HUF, F - Firm, etc.

export const panSchema = z
  .string()
  .toUpperCase()
  .regex(
    /^[A-Z]{3}[ABCFGHLJPTK][A-Z][0-9]{4}[A-Z]$/,
    'Invalid PAN format. Expected format: ABCDE1234F'
  );

// ===========================================
// Aadhaar Number
// ===========================================
// Format: 12 digits, cannot start with 0 or 1
// Verhoeff checksum validation deferred to Phase 2

export const aadhaarSchema = z
  .string()
  .regex(
    /^[2-9][0-9]{11}$/,
    'Invalid Aadhaar number. Must be 12 digits and cannot start with 0 or 1'
  );

// ===========================================
// UPI ID (Virtual Payment Address)
// ===========================================
// NPCI-compliant format: username@handle
// - Username: 3-50 chars, alphanumeric with dots allowed
// - Handle: Valid bank PSP handle (e.g., upi, paytm, okaxis, ybl)
// Max length: 40 characters

const VALID_UPI_HANDLES = [
  'upi', 'oksbi', 'okaxis', 'okicici', 'okhdfcbank',
  'ybl', 'paytm', 'apl', 'axisbank', 'sbi', 'hdfcbank',
  'icici', 'ibl', 'axl', 'indus', 'kbl', 'federal',
  'kotak', 'rbl', 'sib', 'citi', 'idbi', 'hsbc',
  'sc', 'boi', 'pnb', 'unionbank', 'canara', 'bob',
  'indian', 'iob', 'centralbank', 'uco', 'psb', 'cub',
  'kvb', 'dbs', 'dcb', 'jkb', 'karb', 'mahb', 'srcb',
  'tjsb', 'ubi', 'united', 'vijb', 'pingpay', 'gpay',
  'amazonpay', 'freecharge', 'mobikwik', 'airtel',
  'jio', 'slice', 'jupiter', 'fi', 'niyox', 'groww'
] as const;

export const upiIdSchema = z
  .string()
  .max(40, 'UPI ID cannot exceed 40 characters')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}@[a-zA-Z][a-zA-Z0-9]{2,}$/,
    'Invalid UPI ID format. Expected format: username@bankhandle'
  )
  .refine(
    (upi) => {
      const handle = upi.split('@')[1]?.toLowerCase();
      return handle && VALID_UPI_HANDLES.includes(handle as typeof VALID_UPI_HANDLES[number]);
    },
    { message: 'Invalid UPI handle. Please use a valid bank handle.' }
  );

// Relaxed UPI schema for testing (allows any handle)
export const upiIdSchemaRelaxed = z
  .string()
  .max(40, 'UPI ID cannot exceed 40 characters')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}@[a-zA-Z][a-zA-Z0-9]{2,}$/,
    'Invalid UPI ID format. Expected format: username@bankhandle'
  );

// ===========================================
// IFSC Code (Indian Financial System Code)
// ===========================================
// Format: 4 letters (bank) + 0 + 6 alphanumeric (branch)
// Example: SBIN0001234

export const ifscSchema = z
  .string()
  .toUpperCase()
  .regex(
    /^[A-Z]{4}0[A-Z0-9]{6}$/,
    'Invalid IFSC code. Expected format: SBIN0001234'
  );

// ===========================================
// Indian Phone Number
// ===========================================
// Canonical format: +91XXXXXXXXXX (no spaces)
// Must start with 6, 7, 8, or 9

export const indianPhoneSchema = z
  .string()
  .regex(
    /^\+91[6-9][0-9]{9}$/,
    'Invalid phone number. Expected format: +91XXXXXXXXXX'
  );

// Schema for accepting various input formats, normalizes to canonical
export const indianPhoneInputSchema = z
  .string()
  .transform((val) => {
    // Remove all non-digit characters except +
    const cleaned = val.replace(/[^\d+]/g, '');
    
    // Handle different input formats
    if (cleaned.startsWith('+91') && cleaned.length === 13) {
      return cleaned;
    }
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return `+91${cleaned.slice(1)}`;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return cleaned;
  })
  .pipe(indianPhoneSchema);

// ===========================================
// Indian PIN Code (Postal Index Number)
// ===========================================
// Format: 6 digits, cannot start with 0

export const indianPinCodeSchema = z
  .string()
  .regex(
    /^[1-9][0-9]{5}$/,
    'Invalid PIN code. Must be 6 digits and cannot start with 0'
  );

// ===========================================
// Indian States and Union Territories
// ===========================================

export const INDIAN_STATES = [
  // States (28)
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories (8)
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export type IndianState = typeof INDIAN_STATES[number];

export const indianStateSchema = z.enum(INDIAN_STATES, {
  errorMap: () => ({ message: 'Please select a valid Indian state or union territory' }),
});

// ===========================================
// Date of Birth (ISO format)
// ===========================================
// Format: YYYY-MM-DD
// Must be at least 18 years old

export const dateOfBirthSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Invalid date format. Expected: YYYY-MM-DD'
  )
  .refine(
    (date) => {
      const dob = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const dayDiff = today.getDate() - dob.getDate();
      
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) 
        ? age - 1 
        : age;
      
      return actualAge >= 18;
    },
    { message: 'You must be at least 18 years old' }
  );

// ===========================================
// OTP Validation
// ===========================================
// 6-digit numeric OTP

export const otpSchema = z
  .string()
  .regex(/^[0-9]{6}$/, 'OTP must be 6 digits');

// ===========================================
// Combined Sign-Up Schema (Indian)
// ===========================================

export const indianSignUpSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: indianPhoneInputSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  address1: z.string().min(5, 'Address must be at least 5 characters').max(100),
  city: z.string().min(2, 'City must be at least 2 characters').max(50),
  state: indianStateSchema,
  postalCode: indianPinCodeSchema,
  dateOfBirth: dateOfBirthSchema,
  // KYC - At least one required
  pan: panSchema.optional(),
  aadhaar: aadhaarSchema.optional(),
  // Optional fields
  upiId: upiIdSchemaRelaxed.optional(),
}).refine(
  (data) => data.pan || data.aadhaar,
  {
    message: 'Either PAN or Aadhaar is required for KYC verification',
    path: ['pan'],
  }
);

// ===========================================
// Sign-In Schema
// ===========================================

export const indianSignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ===========================================
// OTP Request/Verify Schemas
// ===========================================

export const otpPurposes = ['registration', 'login', 'transaction'] as const;
export type OTPPurpose = typeof otpPurposes[number];

export const otpRequestSchema = z.object({
  phone: indianPhoneSchema,
  purpose: z.enum(otpPurposes),
});

export const otpVerifySchema = z.object({
  phone: indianPhoneSchema,
  otp: otpSchema,
  purpose: z.enum(otpPurposes),
});

// ===========================================
// Type Exports
// ===========================================

export type IndianSignUpData = z.infer<typeof indianSignUpSchema>;
export type IndianSignInData = z.infer<typeof indianSignInSchema>;
export type OTPRequestData = z.infer<typeof otpRequestSchema>;
export type OTPVerifyData = z.infer<typeof otpVerifySchema>;

// ===========================================
// Validation Helper Functions
// ===========================================

type ValidationResult = { success: true; data: string } | { success: false; error: string };

/**
 * Validates IFSC code
 */
export const validateIFSC = (ifsc: string): ValidationResult => {
  const result = ifscSchema.safeParse(ifsc);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid IFSC' };
};

/**
 * Validates UPI VPA
 */
export const validateUPI = (upi: string): ValidationResult => {
  const result = upiIdSchemaRelaxed.safeParse(upi);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid UPI' };
};

/**
 * Validates Indian phone number
 */
export const validatePhone = (phone: string): ValidationResult => {
  const result = indianPhoneInputSchema.safeParse(phone);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid phone' };
};

/**
 * Validates PAN number
 */
export const validatePAN = (pan: string): ValidationResult => {
  const result = panSchema.safeParse(pan);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid PAN' };
};

/**
 * Validates Aadhaar number
 */
export const validateAadhaar = (aadhaar: string): ValidationResult => {
  const result = aadhaarSchema.safeParse(aadhaar);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid Aadhaar' };
};

/**
 * Validates PIN code
 */
export const validatePinCode = (pinCode: string): ValidationResult => {
  const result = indianPinCodeSchema.safeParse(pinCode);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid PIN code' };
};
