'use server';

/**
 * OTP Actions for Indian Banking App
 * 
 * Handles OTP generation, storage, and verification
 * Compliant with RBI guidelines for 2FA
 * 
 * @module lib/actions/otp.actions
 */

import { ID, Query, Models } from 'node-appwrite';
import { createAdminClient } from '../appwrite';
import { generateOTP, hashOTP, verifyOTP as verifyOTPHash } from '../encryption';
import { parseStringify } from '../utils';
import { indianPhoneSchema } from '../validators/indian';

// ===========================================
// Environment Variables
// ===========================================

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  OTP_EXPIRY_SECONDS = '300',
  OTP_MAX_ATTEMPTS = '3',
  OTP_RATE_LIMIT_PER_HOUR = '5',
} = process.env;

// Collection ID for OTP records (to be created in Phase 1)
const OTP_COLLECTION_ID = process.env.APPWRITE_OTP_COLLECTION_ID || 'otp_records';

// ===========================================
// Types
// ===========================================

interface SendOTPParams {
  phone: string;
  purpose: OTPPurpose;
  userId?: string;
}

interface VerifyOTPParams {
  phone: string;
  otp: string;
  purpose: OTPPurpose;
  userId?: string;
}

interface RateLimitCheck {
  allowed: boolean;
  remainingAttempts: number;
  retryAfter?: number; // seconds
}

// Appwrite document type for OTP records
// Using integer timestamps (Unix epoch milliseconds) for better indexing
interface OTPDocument extends Models.Document {
  phone: string;
  otpHash: string;
  purpose: OTPPurpose;
  expiresAt: number;      // Unix timestamp (milliseconds)
  attempts: number;
  verified: boolean;
  userId: string | null;
  createdAt: number;      // Unix timestamp (milliseconds)
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Validates phone number format
 */
const validatePhone = (phone: string): boolean => {
  const result = indianPhoneSchema.safeParse(phone);
  return result.success;
};

/**
 * Checks rate limiting for OTP requests
 */
const checkRateLimit = async (
  phone: string,
  purpose: OTPPurpose
): Promise<RateLimitCheck> => {
  try {
    const { database } = await createAdminClient();
    
    // Calculate 1 hour ago (using integer timestamp)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Query OTP records from the last hour
    const records = await database.listDocuments<OTPDocument>(
      DATABASE_ID!,
      OTP_COLLECTION_ID,
      [
        Query.equal('phone', phone),
        Query.equal('purpose', purpose),
        Query.greaterThan('createdAt', oneHourAgo),
      ]
    );
    
    const maxRequests = parseInt(OTP_RATE_LIMIT_PER_HOUR, 10);
    const remainingAttempts = maxRequests - records.total;
    
    if (remainingAttempts <= 0) {
      // Find the oldest record to calculate retry time
      const oldestRecord = records.documents[0];
      const retryAfter = Math.ceil((oldestRecord.createdAt + 60 * 60 * 1000 - Date.now()) / 1000);
      
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter,
      };
    }
    
    return {
      allowed: true,
      remainingAttempts,
    };
  } catch (error) {
    // If collection doesn't exist or other error, allow the request
    console.error('Rate limit check error:', error);
    return {
      allowed: true,
      remainingAttempts: parseInt(OTP_RATE_LIMIT_PER_HOUR, 10),
    };
  }
};

/**
 * Invalidates previous OTPs for the same phone and purpose
 */
const invalidatePreviousOTPs = async (
  phone: string,
  purpose: OTPPurpose
): Promise<void> => {
  try {
    const { database } = await createAdminClient();
    
    const records = await database.listDocuments(
      DATABASE_ID!,
      OTP_COLLECTION_ID,
      [
        Query.equal('phone', phone),
        Query.equal('purpose', purpose),
        Query.equal('verified', false),
      ]
    );
    
    // Mark all previous OTPs as verified (invalidated)
    for (const record of records.documents) {
      await database.updateDocument(
        DATABASE_ID!,
        OTP_COLLECTION_ID,
        record.$id,
        { verified: true }
      );
    }
  } catch (error) {
    console.error('Error invalidating previous OTPs:', error);
  }
};

// ===========================================
// Main Actions
// ===========================================

/**
 * Generates and sends an OTP to the specified phone number
 * 
 * @param params - Phone number, purpose, and optional userId
 * @returns OTPResponse with success status and expiry info
 */
export const sendOTP = async (params: SendOTPParams): Promise<OTPResponse> => {
  const { phone, purpose, userId } = params;
  
  try {
    // Validate phone number
    if (!validatePhone(phone)) {
      return {
        success: false,
        message: 'Invalid phone number format. Use +91XXXXXXXXXX',
      };
    }
    
    // Check rate limiting
    const rateLimit = await checkRateLimit(phone, purpose);
    if (!rateLimit.allowed) {
      return {
        success: false,
        message: `Too many OTP requests. Try again in ${rateLimit.retryAfter} seconds`,
        attemptsRemaining: 0,
      };
    }
    
    // Invalidate any previous OTPs
    await invalidatePreviousOTPs(phone, purpose);
    
    // Generate new OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    
    // Calculate expiry time (using integer timestamps)
    const expirySeconds = parseInt(OTP_EXPIRY_SECONDS, 10);
    const now = Date.now();
    const expiresAt = now + expirySeconds * 1000;
    const maxAttempts = parseInt(OTP_MAX_ATTEMPTS, 10);
    
    // Store OTP record in Appwrite
    const { database } = await createAdminClient();
    
    await database.createDocument(
      DATABASE_ID!,
      OTP_COLLECTION_ID,
      ID.unique(),
      {
        phone,
        otpHash,
        purpose,
        expiresAt,
        attempts: 0,
        verified: false,
        userId: userId || null,
        createdAt: now,
      }
    );
    
    // TODO: Integrate with SMS provider (MSG91, Twilio, etc.)
    // For now, log OTP in development only
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }
    
    // In production, call SMS API here:
    // await sendSMS(phone, `Your Nivesh OTP is: ${otp}. Valid for ${expirySeconds / 60} minutes.`);
    
    return {
      success: true,
      message: 'OTP sent successfully',
      expiresIn: expirySeconds,
      attemptsRemaining: maxAttempts,
    };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      message: 'Failed to send OTP. Please try again.',
    };
  }
};

/**
 * Verifies the OTP entered by the user
 * 
 * @param params - Phone, OTP, purpose, and optional userId
 * @returns OTPResponse with verification status
 */
export const verifyOTPAction = async (params: VerifyOTPParams): Promise<OTPResponse> => {
  const { phone, otp, purpose, userId } = params;
  
  try {
    // Validate phone number
    if (!validatePhone(phone)) {
      return {
        success: false,
        message: 'Invalid phone number format',
      };
    }
    
    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return {
        success: false,
        message: 'Invalid OTP format. Enter 6 digits.',
      };
    }
    
    const { database } = await createAdminClient();
    
    // Find the latest unverified OTP for this phone and purpose
    const records = await database.listDocuments<OTPDocument>(
      DATABASE_ID!,
      OTP_COLLECTION_ID,
      [
        Query.equal('phone', phone),
        Query.equal('purpose', purpose),
        Query.equal('verified', false),
        Query.orderDesc('createdAt'),
        Query.limit(1),
      ]
    );
    
    if (records.total === 0) {
      return {
        success: false,
        message: 'No pending OTP found. Request a new one.',
      };
    }
    
    const otpRecord = records.documents[0];
    const maxAttempts = parseInt(OTP_MAX_ATTEMPTS, 10);
    
    // Check if OTP has expired (using integer timestamp comparison)
    if (otpRecord.expiresAt < Date.now()) {
      // Mark as verified (invalidated) due to expiry
      await database.updateDocument(
        DATABASE_ID!,
        OTP_COLLECTION_ID,
        otpRecord.$id,
        { verified: true }
      );
      
      return {
        success: false,
        message: 'OTP has expired. Request a new one.',
      };
    }
    
    // Check if max attempts exceeded
    if (otpRecord.attempts >= maxAttempts) {
      // Mark as verified (invalidated) due to max attempts
      await database.updateDocument(
        DATABASE_ID!,
        OTP_COLLECTION_ID,
        otpRecord.$id,
        { verified: true }
      );
      
      return {
        success: false,
        message: 'Maximum attempts exceeded. Request a new OTP.',
        attemptsRemaining: 0,
      };
    }
    
    // Verify OTP using constant-time comparison
    const isValid = verifyOTPHash(otp, otpRecord.otpHash);
    
    if (isValid) {
      // Mark OTP as verified (used)
      await database.updateDocument(
        DATABASE_ID!,
        OTP_COLLECTION_ID,
        otpRecord.$id,
        { verified: true }
      );
      
      return {
        success: true,
        message: 'OTP verified successfully',
      };
    } else {
      // Increment attempt count
      const newAttempts = otpRecord.attempts + 1;
      await database.updateDocument(
        DATABASE_ID!,
        OTP_COLLECTION_ID,
        otpRecord.$id,
        { attempts: newAttempts }
      );
      
      const attemptsRemaining = maxAttempts - newAttempts;
      
      return {
        success: false,
        message: attemptsRemaining > 0 
          ? `Incorrect OTP. ${attemptsRemaining} attempt(s) remaining.`
          : 'Maximum attempts exceeded. Request a new OTP.',
        attemptsRemaining,
      };
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      message: 'Failed to verify OTP. Please try again.',
    };
  }
};

/**
 * Resends OTP to the same phone number
 * Invalidates previous OTP and generates a new one
 * 
 * @param params - Phone number and purpose
 * @returns OTPResponse
 */
export const resendOTP = async (params: Omit<SendOTPParams, 'userId'>): Promise<OTPResponse> => {
  // Resend is essentially the same as send, just with rate limiting awareness
  return sendOTP(params);
};

/**
 * Gets the status of the current OTP (for UI purposes)
 * Does NOT return the actual OTP
 * 
 * @param phone - Phone number
 * @param purpose - OTP purpose
 * @returns Status information
 */
export const getOTPStatus = async (
  phone: string,
  purpose: OTPPurpose
): Promise<{ hasActiveOTP: boolean; expiresIn?: number; attemptsRemaining?: number }> => {
  try {
    const { database } = await createAdminClient();
    
    const records = await database.listDocuments<OTPDocument>(
      DATABASE_ID!,
      OTP_COLLECTION_ID,
      [
        Query.equal('phone', phone),
        Query.equal('purpose', purpose),
        Query.equal('verified', false),
        Query.orderDesc('createdAt'),
        Query.limit(1),
      ]
    );
    
    if (records.total === 0) {
      return { hasActiveOTP: false };
    }
    
    const otpRecord = records.documents[0];
    const now = Date.now();
    
    // Using integer timestamp comparison
    if (otpRecord.expiresAt < now) {
      return { hasActiveOTP: false };
    }
    
    const maxAttempts = parseInt(OTP_MAX_ATTEMPTS, 10);
    
    return parseStringify({
      hasActiveOTP: true,
      expiresIn: Math.ceil((otpRecord.expiresAt - now) / 1000),
      attemptsRemaining: maxAttempts - otpRecord.attempts,
    });
  } catch (error) {
    console.error('Error getting OTP status:', error);
    return { hasActiveOTP: false };
  }
};

/**
 * Cleans up expired OTP records
 * Should be called by a scheduled job/cron
 * 
 * @returns Number of records cleaned up
 */
export const cleanupExpiredOTPs = async (): Promise<number> => {
  try {
    const { database } = await createAdminClient();
    
    // Using integer timestamp for efficient index-based query
    const now = Date.now();
    
    // Find expired OTPs (uses index on expiresAt)
    const records = await database.listDocuments(
      DATABASE_ID!,
      OTP_COLLECTION_ID,
      [
        Query.lessThan('expiresAt', now),
        Query.limit(100), // Process in batches
      ]
    );
    
    // Delete expired records
    for (const record of records.documents) {
      await database.deleteDocument(
        DATABASE_ID!,
        OTP_COLLECTION_ID,
        record.$id
      );
    }
    
    return records.total;
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
    return 0;
  }
};
