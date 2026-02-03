/**
 * Sensitive Action OTP Verification
 * 
 * Middleware and utilities for requiring OTP verification on sensitive actions.
 * Implements 2FA for transactions, profile changes, and other high-risk operations.
 * 
 * @module lib/actions/sensitive-action.actions
 */

'use server';

import { ID, Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite';
import { generateOTP, verifyOTP, hashOTP, generateSecureToken } from '@/lib/encryption';
import { parseStringify } from '@/lib/utils';
import crypto from 'crypto';

// ===========================================
// Environment Configuration
// ===========================================

const {
  APPWRITE_DATABASE_ID,
  OTP_EXPIRY_SECONDS = '300',
  OTP_MAX_ATTEMPTS = '3',
} = process.env;

const SENSITIVE_OTP_COLLECTION = 'sensitive_action_otp';

// ===========================================
// Types
// ===========================================

/**
 * Sensitive action types that require OTP verification
 */
export type SensitiveActionType =
  | 'transaction'           // Money transfers
  | 'payout'                // Payouts to external accounts
  | 'add_beneficiary'       // Adding new beneficiaries
  | 'remove_beneficiary'    // Removing beneficiaries
  | 'profile_update'        // Profile changes
  | 'password_change'       // Password changes
  | 'email_change'          // Email changes
  | 'phone_change'          // Phone number changes
  | 'bank_link'             // Linking new bank accounts
  | 'bank_unlink'           // Unlinking bank accounts
  | 'consent_revoke'        // Revoking AA consent
  | 'session_logout_all';   // Logging out all sessions

/**
 * OTP request for sensitive action
 */
interface SensitiveActionOTPRequest {
  userId: string;
  actionType: SensitiveActionType;
  actionData?: Record<string, unknown>; // Action-specific data for verification
  phone?: string; // Override default phone
}

/**
 * OTP verification result
 */
interface OTPVerificationResult {
  success: boolean;
  verified: boolean;
  token?: string; // One-time use token for action execution
  error?: string;
  attemptsRemaining?: number;
}

/**
 * Sensitive action OTP record
 */
interface SensitiveOTPRecord {
  $id: string;
  userId: string;
  phone: string;
  actionType: SensitiveActionType;
  actionDataHash: string; // Hash of action data for tamper detection
  otpHash: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
  executionToken?: string;
  tokenUsed: boolean;
  createdAt: number;
}

// ===========================================
// OTP Generation and Sending
// ===========================================

/**
 * Requests OTP for a sensitive action
 * 
 * @param params - OTP request parameters
 * @returns OTP send result
 */
export const requestSensitiveActionOTP = async (
  params: SensitiveActionOTPRequest
): Promise<{ success: boolean; expiresIn?: number; error?: string }> => {
  const { userId, actionType, actionData, phone: overridePhone } = params;
  
  try {
    const { database } = await createAdminClient();
    
    // Get user's phone number if not provided
    let phone = overridePhone;
    if (!phone) {
      const users = await database.listDocuments(
        APPWRITE_DATABASE_ID!,
        'users',
        [Query.equal('userId', userId), Query.limit(1)]
      );
      
      if (users.documents.length === 0) {
        return { success: false, error: 'User not found' };
      }
      
      phone = (users.documents[0] as unknown as { phone: string }).phone;
    }
    
    // Check for existing unexpired OTP
    const existingOTPs = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      [
        Query.equal('userId', userId),
        Query.equal('actionType', actionType),
        Query.greaterThan('expiresAt', Date.now()),
        Query.equal('verified', false),
        Query.limit(1),
      ]
    );
    
    // If valid OTP exists, don't send new one (rate limiting)
    if (existingOTPs.documents.length > 0) {
      const existing = existingOTPs.documents[0] as unknown as SensitiveOTPRecord;
      const remainingSeconds = Math.floor((existing.expiresAt - Date.now()) / 1000);
      return {
        success: true,
        expiresIn: remainingSeconds,
      };
    }
    
    // Generate new OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = Date.now() + parseInt(OTP_EXPIRY_SECONDS) * 1000;
    
    // Hash action data for tamper detection
    const actionDataHash = actionData
      ? crypto.createHash('sha256').update(JSON.stringify(actionData)).digest('hex')
      : '';
    
    // Store OTP record
    await database.createDocument(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      ID.unique(),
      {
        userId,
        phone,
        actionType,
        actionDataHash,
        otpHash,
        expiresAt,
        attempts: 0,
        verified: false,
        tokenUsed: false,
        createdAt: Date.now(),
      }
    );
    
    // TODO: Send OTP via SMS provider
    // In production, integrate with MSG91, Twilio, etc.
    // For now, log OTP in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Sensitive Action OTP for ${phone}: ${otp}`);
    }
    
    return {
      success: true,
      expiresIn: parseInt(OTP_EXPIRY_SECONDS),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP';
    return { success: false, error: message };
  }
};

// ===========================================
// OTP Verification
// ===========================================

/**
 * Verifies OTP for sensitive action
 * Returns a one-time execution token if successful
 * 
 * @param params - Verification parameters
 * @returns Verification result with execution token
 */
export const verifySensitiveActionOTP = async (params: {
  userId: string;
  actionType: SensitiveActionType;
  otp: string;
  actionData?: Record<string, unknown>;
}): Promise<OTPVerificationResult> => {
  const { userId, actionType, otp, actionData } = params;
  
  try {
    const { database } = await createAdminClient();
    
    // Find the OTP record
    const otpRecords = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      [
        Query.equal('userId', userId),
        Query.equal('actionType', actionType),
        Query.greaterThan('expiresAt', Date.now()),
        Query.equal('verified', false),
        Query.orderDesc('createdAt'),
        Query.limit(1),
      ]
    );
    
    if (otpRecords.documents.length === 0) {
      return {
        success: false,
        verified: false,
        error: 'No valid OTP found. Please request a new one.',
      };
    }
    
    const otpRecord = otpRecords.documents[0] as unknown as SensitiveOTPRecord;
    
    // Check max attempts
    if (otpRecord.attempts >= parseInt(OTP_MAX_ATTEMPTS)) {
      return {
        success: false,
        verified: false,
        error: 'Maximum attempts exceeded. Please request a new OTP.',
        attemptsRemaining: 0,
      };
    }
    
    // Verify OTP
    const isValid = verifyOTP(otp, otpRecord.otpHash);
    
    if (!isValid) {
      // Increment attempts
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        SENSITIVE_OTP_COLLECTION,
        otpRecord.$id,
        { attempts: otpRecord.attempts + 1 }
      );
      
      return {
        success: true,
        verified: false,
        error: 'Invalid OTP',
        attemptsRemaining: parseInt(OTP_MAX_ATTEMPTS) - otpRecord.attempts - 1,
      };
    }
    
    // Verify action data hasn't been tampered with (if provided)
    if (actionData && otpRecord.actionDataHash) {
      const currentHash = crypto.createHash('sha256').update(JSON.stringify(actionData)).digest('hex');
      if (currentHash !== otpRecord.actionDataHash) {
        return {
          success: false,
          verified: false,
          error: 'Action data has been modified. Please request a new OTP.',
        };
      }
    }
    
    // Generate one-time execution token
    const executionToken = `${ID.unique()}_${Date.now()}`;
    
    // Mark as verified and store token
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      otpRecord.$id,
      {
        verified: true,
        executionToken,
      }
    );
    
    return {
      success: true,
      verified: true,
      token: executionToken,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    return { success: false, verified: false, error: message };
  }
};

// ===========================================
// Token Validation (for action execution)
// ===========================================

/**
 * Validates execution token before performing sensitive action
 * Tokens are single-use and expire after verification
 * 
 * @param params - Token validation parameters
 * @returns Validation result
 */
export const validateExecutionToken = async (params: {
  userId: string;
  actionType: SensitiveActionType;
  token: string;
}): Promise<{ valid: boolean; error?: string }> => {
  const { userId, actionType, token } = params;
  
  try {
    const { database } = await createAdminClient();
    
    // Find token
    const records = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      [
        Query.equal('userId', userId),
        Query.equal('actionType', actionType),
        Query.equal('executionToken', token),
        Query.equal('verified', true),
        Query.equal('tokenUsed', false),
        Query.limit(1),
      ]
    );
    
    if (records.documents.length === 0) {
      return { valid: false, error: 'Invalid or expired token' };
    }
    
    const record = records.documents[0] as unknown as SensitiveOTPRecord;
    
    // Check if OTP expired (token inherits OTP expiry + 5 min grace)
    const tokenExpiry = record.expiresAt + 5 * 60 * 1000;
    if (Date.now() > tokenExpiry) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Mark token as used (single-use)
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      record.$id,
      { tokenUsed: true }
    );
    
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token validation failed';
    return { valid: false, error: message };
  }
};

// ===========================================
// Helper: Wrap Sensitive Action
// ===========================================

/**
 * Higher-order function to wrap sensitive actions with OTP verification
 * 
 * @param action - The sensitive action to execute
 * @param actionType - Type of sensitive action
 * @returns Wrapped action that requires token
 */
export const withOTPVerification = <T, R>(
  action: (params: T) => Promise<R>,
  actionType: SensitiveActionType
) => {
  return async (params: T & { userId: string; otpToken: string }): Promise<R | { success: false; error: string }> => {
    const { userId, otpToken, ...actionParams } = params;
    
    // Validate token
    const tokenResult = await validateExecutionToken({
      userId,
      actionType,
      token: otpToken,
    });
    
    if (!tokenResult.valid) {
      return { success: false, error: tokenResult.error || 'Invalid OTP verification' };
    }
    
    // Execute action
    return action(actionParams as unknown as T);
  };
};

// ===========================================
// Cleanup
// ===========================================

/**
 * Cleans up expired OTP records
 * Should be run periodically
 */
export const cleanupExpiredSensitiveOTPs = async (): Promise<{
  success: boolean;
  deleted: number;
  error?: string;
}> => {
  try {
    const { database } = await createAdminClient();
    
    // Find expired records
    const expiredRecords = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      SENSITIVE_OTP_COLLECTION,
      [
        Query.lessThan('expiresAt', Date.now() - 24 * 60 * 60 * 1000), // Expired > 24h ago
        Query.limit(100),
      ]
    );
    
    // Delete them
    let deleted = 0;
    for (const record of expiredRecords.documents) {
      await database.deleteDocument(
        APPWRITE_DATABASE_ID!,
        SENSITIVE_OTP_COLLECTION,
        record.$id
      );
      deleted++;
    }
    
    return { success: true, deleted };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    return { success: false, deleted: 0, error: message };
  }
};
