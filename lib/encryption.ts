/**
 * Encryption Utilities for Sensitive Data
 * Uses AES-256-GCM for encryption and SHA-256/HMAC for hashing
 * 
 * @module lib/encryption
 */

import * as crypto from 'crypto';

// ===========================================
// Environment Validation
// ===========================================

const getEncryptionKey = (): Uint8Array => {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  
  const keyBuffer = Buffer.from(key, 'base64');
  
  if (keyBuffer.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 32 bytes (256 bits) when decoded from base64'
    );
  }
  
  return new Uint8Array(keyBuffer);
};

const getOTPSecret = (): string => {
  const secret = process.env.OTP_SECRET;
  
  if (!secret) {
    throw new Error(
      'OTP_SECRET environment variable is not set. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  
  return secret;
};

// ===========================================
// AES-256-GCM Encryption
// ===========================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypts sensitive data using AES-256-GCM
 * 
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all base64)
 * 
 * @example
 * const encrypted = encrypt('ABCDE1234F');
 * // Returns: "abc123...:def456...:ghi789..."
 */
export const encrypt = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, new Uint8Array(iv), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
};

/**
 * Decrypts data encrypted with encrypt()
 * 
 * @param encryptedData - The encrypted string from encrypt()
 * @returns Original plaintext
 * 
 * @throws Error if decryption fails or data is tampered
 */
export const decrypt = (encryptedData: string): string => {
  const key = getEncryptionKey();
  
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivBase64, authTagBase64, ciphertext] = parts;
  
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, new Uint8Array(iv), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(new Uint8Array(authTag));
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// ===========================================
// Hashing Functions
// ===========================================

/**
 * Creates a SHA-256 hash of the Aadhaar number
 * Used for lookup without storing raw Aadhaar
 * 
 * @param aadhaar - 12-digit Aadhaar number
 * @returns SHA-256 hash as hex string
 */
export const hashAadhaar = (aadhaar: string): string => {
  return crypto
    .createHash('sha256')
    .update(aadhaar)
    .digest('hex');
};

/**
 * Extracts the last 4 digits of Aadhaar for display
 * 
 * @param aadhaar - 12-digit Aadhaar number
 * @returns Last 4 digits
 */
export const getAadhaarLastFour = (aadhaar: string): string => {
  return aadhaar.slice(-4);
};

/**
 * Masks an Aadhaar number for display
 * 
 * @param aadhaar - 12-digit Aadhaar number
 * @returns Masked format: XXXX XXXX 1234
 */
export const maskAadhaar = (aadhaar: string): string => {
  const lastFour = aadhaar.slice(-4);
  return `XXXX XXXX ${lastFour}`;
};

/**
 * Masks a PAN number for display
 * 
 * @param pan - 10-character PAN
 * @returns Masked format: ABCDE****F
 */
export const maskPAN = (pan: string): string => {
  return `${pan.slice(0, 5)}****${pan.slice(-1)}`;
};

// ===========================================
// OTP Functions (HMAC-SHA256)
// ===========================================

/**
 * Generates a secure 6-digit OTP
 * 
 * @returns 6-digit OTP string
 */
export const generateOTP = (): string => {
  // Generate random bytes and convert to 6-digit number
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  const otp = (randomNumber % 900000) + 100000; // Ensures 6 digits (100000-999999)
  return otp.toString();
};

/**
 * Creates an HMAC-SHA256 hash of the OTP
 * Used for secure storage and comparison
 * 
 * @param otp - The OTP to hash
 * @returns HMAC-SHA256 hash as hex string
 */
export const hashOTP = (otp: string): string => {
  const secret = getOTPSecret();
  const secretBuffer = new Uint8Array(Buffer.from(secret, 'base64'));
  return crypto
    .createHmac('sha256', secretBuffer)
    .update(otp)
    .digest('hex');
};

/**
 * Verifies an OTP using constant-time comparison
 * Prevents timing attacks
 * 
 * @param inputOTP - The OTP entered by user
 * @param storedHash - The stored HMAC hash
 * @returns true if OTP matches
 */
export const verifyOTP = (inputOTP: string, storedHash: string): boolean => {
  const inputHash = hashOTP(inputOTP);
  
  // Convert to Uint8Array for constant-time comparison
  const inputBuffer = new Uint8Array(Buffer.from(inputHash, 'hex'));
  const storedBuffer = new Uint8Array(Buffer.from(storedHash, 'hex'));
  
  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Generates a cryptographically secure random string
 * 
 * @param length - Number of bytes (output will be 2x in hex)
 * @returns Random hex string
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Validates if the encryption key is properly configured
 * Call this at startup to fail fast
 * 
 * @returns true if encryption is properly configured
 * @throws Error if configuration is invalid
 */
export const validateEncryptionConfig = (): boolean => {
  try {
    getEncryptionKey();
    getOTPSecret();
    return true;
  } catch (error) {
    throw error;
  }
};
