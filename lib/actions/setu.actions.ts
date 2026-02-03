'use server';

/**
 * Setu Account Aggregator Actions
 * 
 * Server actions for managing Setu AA consent and data fetching.
 * Integrates with Appwrite for persistence and user management.
 * 
 * @module lib/actions/setu.actions
 */

import { ID, Query, Models } from 'node-appwrite';
import { createAdminClient } from '../appwrite';
import { parseStringify } from '../utils';
import {
  createConsent,
  getConsent,
  revokeConsent,
  createDataSession,
  getDataSession,
  fetchFIData,
  formatVUA,
  parseBankAccounts,
  getDefaultConsentRequest,
  validateSetuConfig,
  type ConsentResponse,
  type FIDataResponse,
  type FIType,
  type ConsentPurpose,
} from '../setu';

// ===========================================
// Environment Variables
// ===========================================

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  NEXT_PUBLIC_SITE_URL,
} = process.env;

// Collection IDs
const CONSENT_COLLECTION_ID = process.env.APPWRITE_CONSENT_COLLECTION_ID || 'setu_consents';
const BANK_ACCOUNT_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNT_COLLECTION_ID || 'bank_accounts_india';

// ===========================================
// Types
// ===========================================

interface SetuConsentDocument extends Models.Document {
  userId: string;
  consentId: string;
  status: SetuConsentStatus;
  vua: string;
  fiTypes: string;        // JSON stringified array
  redirectUrl: string;
  referenceId?: string;
  createdAt: number;
  expiresAt: number;
  approvedAt?: number;
  revokedAt?: number;
}

interface CreateConsentParams {
  userId: string;
  phone: string;
  purpose?: SetuConsentPurpose;
  fiTypes?: SetuFIType[];
  redirectUrl?: string;
}

interface FetchDataParams {
  userId: string;
  consentId: string;
  fromDate?: string;
  toDate?: string;
}

// ===========================================
// Consent Management
// ===========================================

/**
 * Creates a new Setu AA consent request
 * 
 * @param params - User ID, phone, and optional consent parameters
 * @returns Consent details with redirect URL
 */
export const createSetuConsent = async (
  params: CreateConsentParams
): Promise<{ success: boolean; consent?: SetuConsent; redirectUrl?: string; error?: string }> => {
  const { userId, phone, purpose, fiTypes, redirectUrl } = params;
  
  try {
    // Validate Setu configuration
    const config = validateSetuConfig();
    if (!config.valid) {
      return {
        success: false,
        error: `Setu configuration missing: ${config.missing.join(', ')}`,
      };
    }
    
    // Build redirect URL
    const callbackUrl = redirectUrl || `${NEXT_PUBLIC_SITE_URL}/api/setu/callback`;
    
    // Get default consent request and override with params
    const defaultRequest = getDefaultConsentRequest(phone, callbackUrl);
    
    const consentRequest = {
      ...defaultRequest,
      ...(purpose && { purpose }),
      ...(fiTypes && { fiTypes }),
      referenceId: `${userId}-${Date.now()}`,
    };
    
    // Create consent via Setu API
    const response = await createConsent(consentRequest);
    
    // Store consent record in Appwrite
    const { database } = await createAdminClient();
    
    const now = Date.now();
    const oneYearLater = now + 365 * 24 * 60 * 60 * 1000;
    
    await database.createDocument(
      DATABASE_ID!,
      CONSENT_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        consentId: response.id,
        status: response.status,
        vua: formatVUA(phone),
        fiTypes: JSON.stringify(consentRequest.fiTypes),
        redirectUrl: callbackUrl,
        referenceId: consentRequest.referenceId,
        createdAt: now,
        expiresAt: oneYearLater,
      }
    );
    
    return {
      success: true,
      consent: {
        consentId: response.id,
        consentHandle: response.detail?.consentHandle || '',
        status: response.status as SetuConsentStatus,
        redirectUrl: response.url,
        vua: formatVUA(phone),
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(oneYearLater).toISOString(),
        fiTypes: consentRequest.fiTypes as SetuFIType[],
        usageCount: 0,
      },
      redirectUrl: response.url,
    };
  } catch (error) {
    console.error('Error creating Setu consent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create consent',
    };
  }
};

/**
 * Gets consent status from Setu and updates local record
 * 
 * @param consentId - Setu consent ID
 * @returns Updated consent status
 */
export const getSetuConsentStatus = async (
  consentId: string
): Promise<{ success: boolean; consent?: SetuConsent; error?: string }> => {
  try {
    // Fetch from Setu API
    const response = await getConsent(consentId);
    
    // Update local record
    const { database } = await createAdminClient();
    
    const records = await database.listDocuments<SetuConsentDocument>(
      DATABASE_ID!,
      CONSENT_COLLECTION_ID,
      [Query.equal('consentId', consentId)]
    );
    
    if (records.total > 0) {
      const record = records.documents[0];
      const updateData: Record<string, string | number | null> = {
        status: response.status,
      };
      
      if (response.status === 'APPROVED' && !record.approvedAt) {
        updateData.approvedAt = Date.now();
      }
      
      await database.updateDocument(
        DATABASE_ID!,
        CONSENT_COLLECTION_ID,
        record.$id,
        updateData
      );
    }
    
    return {
      success: true,
      consent: {
        consentId: response.id,
        consentHandle: response.detail?.consentHandle || '',
        status: response.status as SetuConsentStatus,
        redirectUrl: response.redirectUrl,
        vua: response.detail?.vua,
        createdAt: response.createdAt,
        expiresAt: '', // Not returned by API
        fiTypes: (response.detail?.fiTypes || []) as SetuFIType[],
        usageCount: response.usage?.count || 0,
        lastUsed: response.usage?.lastUsed,
      },
    };
  } catch (error) {
    console.error('Error getting consent status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get consent status',
    };
  }
};

/**
 * Revokes an existing consent
 * 
 * @param consentId - Consent ID to revoke
 * @returns Success status
 */
export const revokeSetuConsent = async (
  consentId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Revoke via Setu API
    await revokeConsent(consentId);
    
    // Update local record
    const { database } = await createAdminClient();
    
    const records = await database.listDocuments<SetuConsentDocument>(
      DATABASE_ID!,
      CONSENT_COLLECTION_ID,
      [Query.equal('consentId', consentId)]
    );
    
    if (records.total > 0) {
      await database.updateDocument(
        DATABASE_ID!,
        CONSENT_COLLECTION_ID,
        records.documents[0].$id,
        {
          status: 'REVOKED',
          revokedAt: Date.now(),
        }
      );
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error revoking consent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke consent',
    };
  }
};

/**
 * Gets all consents for a user
 * 
 * @param userId - User ID
 * @returns List of consents
 */
export const getUserConsents = async (
  userId: string
): Promise<{ success: boolean; consents: SetuConsentRecord[]; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    const records = await database.listDocuments<SetuConsentDocument>(
      DATABASE_ID!,
      CONSENT_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
      ]
    );
    
    const consents: SetuConsentRecord[] = records.documents.map(doc => ({
      $id: doc.$id,
      userId: doc.userId,
      consentId: doc.consentId,
      status: doc.status as SetuConsentStatus,
      vua: doc.vua,
      fiTypes: doc.fiTypes,
      redirectUrl: doc.redirectUrl,
      referenceId: doc.referenceId,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      approvedAt: doc.approvedAt,
      revokedAt: doc.revokedAt,
    }));
    
    return { success: true, consents };
  } catch (error) {
    console.error('Error getting user consents:', error);
    return {
      success: false,
      consents: [],
      error: error instanceof Error ? error.message : 'Failed to get consents',
    };
  }
};

// ===========================================
// Data Fetching
// ===========================================

/**
 * Fetches financial data using an approved consent
 * 
 * @param params - Consent ID and optional date range
 * @returns Bank accounts and financial data
 */
export const fetchSetuData = async (
  params: FetchDataParams
): Promise<{
  success: boolean;
  accounts?: SetuDiscoveredAccount[];
  rawData?: FIDataResponse;
  error?: string;
}> => {
  const { userId, consentId, fromDate, toDate } = params;
  
  try {
    // Verify consent status
    const consentStatus = await getSetuConsentStatus(consentId);
    if (!consentStatus.success || consentStatus.consent?.status !== 'APPROVED') {
      return {
        success: false,
        error: 'Consent is not approved',
      };
    }
    
    // Calculate date range
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    const dataRange = {
      from: fromDate || oneYearAgo.toISOString().split('T')[0],
      to: toDate || now.toISOString().split('T')[0],
    };
    
    // Create data session
    const session = await createDataSession({
      consentId,
      dataRange,
      format: 'json',
    });
    
    // Poll for session completion (with timeout)
    let sessionStatus = session.status;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (sessionStatus === 'PENDING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await getDataSession(session.id);
      sessionStatus = statusResponse.status;
      attempts++;
    }
    
    if (sessionStatus !== 'COMPLETED') {
      return {
        success: false,
        error: `Data session failed with status: ${sessionStatus}`,
      };
    }
    
    // Fetch the actual data
    const fiData = await fetchFIData(session.id);
    
    // Parse bank accounts
    const accounts = parseBankAccounts(fiData).map(acc => ({
      accountNumber: acc.accountNumber,
      maskedNumber: acc.maskedNumber,
      ifsc: acc.ifsc,
      bankName: acc.bankName,
      fipId: '', // Would need to extract from raw data
      accountType: acc.type.toLowerCase() as 'savings' | 'current' | 'term_deposit' | 'recurring_deposit',
      holderName: undefined,
      balance: acc.balance,
      currency: acc.currency,
    }));
    
    return {
      success: true,
      accounts,
      rawData: fiData,
    };
  } catch (error) {
    console.error('Error fetching Setu data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch data',
    };
  }
};

// ===========================================
// Webhook Handler
// ===========================================

/**
 * Handles Setu webhook events
 * 
 * @param event - Webhook event type
 * @param data - Event data
 * @returns Processing result
 */
export const handleSetuWebhook = async (
  event: string,
  data: {
    consentId?: string;
    sessionId?: string;
    status: string;
    details?: Record<string, unknown>;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    switch (event) {
      case 'CONSENT_APPROVED': {
        if (!data.consentId) break;
        
        const records = await database.listDocuments<SetuConsentDocument>(
          DATABASE_ID!,
          CONSENT_COLLECTION_ID,
          [Query.equal('consentId', data.consentId)]
        );
        
        if (records.total > 0) {
          await database.updateDocument(
            DATABASE_ID!,
            CONSENT_COLLECTION_ID,
            records.documents[0].$id,
            {
              status: 'APPROVED',
              approvedAt: Date.now(),
            }
          );
        }
        break;
      }
      
      case 'CONSENT_REJECTED':
      case 'CONSENT_REVOKED':
      case 'CONSENT_EXPIRED': {
        if (!data.consentId) break;
        
        const status = event.replace('CONSENT_', '') as SetuConsentStatus;
        
        const records = await database.listDocuments<SetuConsentDocument>(
          DATABASE_ID!,
          CONSENT_COLLECTION_ID,
          [Query.equal('consentId', data.consentId)]
        );
        
        if (records.total > 0) {
          const updateData: Record<string, string | number> = { status };
          if (status === 'REVOKED') {
            updateData.revokedAt = Date.now();
          }
          
          await database.updateDocument(
            DATABASE_ID!,
            CONSENT_COLLECTION_ID,
            records.documents[0].$id,
            updateData
          );
        }
        break;
      }
      
      case 'SESSION_COMPLETED':
      case 'SESSION_FAILED': {
        // Log session events for debugging
        console.log(`Setu session event: ${event}`, data);
        break;
      }
      
      default:
        console.log(`Unknown Setu webhook event: ${event}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error handling Setu webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed',
    };
  }
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Checks if user has an active (approved) consent
 * 
 * @param userId - User ID
 * @returns True if active consent exists
 */
export const hasActiveConsent = async (userId: string): Promise<boolean> => {
  try {
    const { database } = await createAdminClient();
    
    const now = Date.now();
    
    const records = await database.listDocuments<SetuConsentDocument>(
      DATABASE_ID!,
      CONSENT_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('status', 'APPROVED'),
        Query.greaterThan('expiresAt', now),
      ]
    );
    
    return records.total > 0;
  } catch (error) {
    console.error('Error checking active consent:', error);
    return false;
  }
};

/**
 * Gets the most recent approved consent for a user
 * 
 * @param userId - User ID
 * @returns Active consent or null
 */
export const getActiveConsent = async (
  userId: string
): Promise<SetuConsentRecord | null> => {
  try {
    const { database } = await createAdminClient();
    
    const now = Date.now();
    
    const records = await database.listDocuments<SetuConsentDocument>(
      DATABASE_ID!,
      CONSENT_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('status', 'APPROVED'),
        Query.greaterThan('expiresAt', now),
        Query.orderDesc('approvedAt'),
        Query.limit(1),
      ]
    );
    
    if (records.total === 0) {
      return null;
    }
    
    const doc = records.documents[0];
    return parseStringify({
      $id: doc.$id,
      userId: doc.userId,
      consentId: doc.consentId,
      status: doc.status as SetuConsentStatus,
      vua: doc.vua,
      fiTypes: doc.fiTypes,
      redirectUrl: doc.redirectUrl,
      referenceId: doc.referenceId,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      approvedAt: doc.approvedAt,
      revokedAt: doc.revokedAt,
    });
  } catch (error) {
    console.error('Error getting active consent:', error);
    return null;
  }
};
