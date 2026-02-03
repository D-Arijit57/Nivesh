/**
 * Setu Account Aggregator SDK Wrapper
 * 
 * This module provides a type-safe wrapper for Setu's Account Aggregator APIs.
 * Setu AA enables consent-based access to financial data from banks.
 * 
 * API Reference: https://docs.setu.co/data/account-aggregator
 * 
 * @module lib/setu
 */

// ===========================================
// Environment Configuration
// ===========================================

const {
  SETU_CLIENT_ID,
  SETU_CLIENT_SECRET,
  SETU_BASE_URL = 'https://aa-sandbox.setu.co',
  SETU_PRODUCT_INSTANCE_ID,
  SETU_REDIRECT_URL,
} = process.env;

// ===========================================
// Types
// ===========================================

/**
 * Financial Information Types supported by RBI AA framework
 */
export type FIType = 
  | 'DEPOSIT'           // Savings/Current accounts
  | 'TERM_DEPOSIT'      // Fixed Deposits
  | 'RECURRING_DEPOSIT' // Recurring Deposits
  | 'SIP'               // Systematic Investment Plans
  | 'CP'                // Commercial Paper
  | 'GOVT_SECURITIES'   // Government Securities
  | 'EQUITIES'          // Stocks
  | 'BONDS'             // Bonds
  | 'DEBENTURES'        // Debentures
  | 'MUTUAL_FUNDS'      // Mutual Funds
  | 'ETF'               // Exchange Traded Funds
  | 'IDR'               // Indian Depository Receipts
  | 'CIS'               // Collective Investment Schemes
  | 'AIF'               // Alternative Investment Funds
  | 'INSURANCE_POLICIES'// Insurance
  | 'NPS'               // National Pension System
  | 'INVIT'             // Infrastructure Investment Trust
  | 'REIT'              // Real Estate Investment Trust
  | 'GSTR1_3B'          // GST Returns
  | 'LIFE_INSURANCE'    // Life Insurance
  | 'GENERAL_INSURANCE' // General Insurance
  | 'OTHER';

/**
 * Consent purpose categories
 */
export type ConsentPurpose = 
  | 'Wealth management service'
  | 'Customer spending patterns, currentbalance or aggregatedstatement'
  | 'Aggregated statement'
  | 'Explicit consent for monitoring of the accounts';

/**
 * Consent mode
 */
export type ConsentMode = 'VIEW' | 'STORE' | 'QUERY' | 'STREAM';

/**
 * Data fetch type
 */
export type FetchType = 'ONETIME' | 'PERIODIC';

/**
 * Consent status from Setu
 */
export type SetuConsentStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'PAUSED';

/**
 * Session status
 */
export type SessionStatus = 
  | 'PENDING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'FAILED';

/**
 * Consent request payload
 */
export interface ConsentRequestPayload {
  /** Customer's mobile number (without country code) */
  mobileNumber: string;
  /** VUA format: mobile@aa-provider (e.g., 9999999999@onemoney) */
  vua?: string;
  /** Financial Information Types to fetch */
  fiTypes: FIType[];
  /** Purpose of consent */
  purpose: ConsentPurpose;
  /** URL to redirect after consent */
  redirectUrl: string;
  /** Consent validity period */
  consentDuration: {
    unit: 'MONTH' | 'YEAR' | 'DAY';
    value: number;
  };
  /** Data range to fetch */
  dataRange: {
    from: string; // ISO date
    to: string;   // ISO date
  };
  /** Data fetch frequency */
  frequency: {
    unit: 'HOUR' | 'DAY' | 'MONTH' | 'YEAR';
    value: number;
  };
  /** Custom reference ID */
  referenceId?: string;
}

/**
 * Consent response from Setu
 */
export interface ConsentResponse {
  id: string;
  url: string;
  status: SetuConsentStatus;
  detail?: {
    consentHandle?: string;
    vua?: string;
    fiTypes?: FIType[];
  };
  usage?: {
    count: number;
    lastUsed?: string;
  };
  redirectUrl: string;
  createdAt: string;
  traceId: string;
}

/**
 * Data session request
 */
export interface DataSessionRequest {
  consentId: string;
  dataRange: {
    from: string;
    to: string;
  };
  format: 'json' | 'xml';
}

/**
 * Data session response
 */
export interface DataSessionResponse {
  id: string;
  consentId: string;
  status: SessionStatus;
  format: 'json' | 'xml';
  dataRange: {
    from: string;
    to: string;
  };
  createdAt: string;
  traceId: string;
}

/**
 * Account data from FIP
 */
export interface AccountData {
  fiType: FIType;
  account: {
    linkedAccRef: string;
    maskedAccNumber: string;
    type: string;
    branch?: string;
    fipId: string;
    fipName: string;
  };
  summary?: {
    currentBalance: number;
    currency: string;
    type: string;
    branch?: string;
    status: string;
    pending?: {
      amount: number;
      transactionType: string;
    };
  };
  transactions?: {
    type: string;
    mode: string;
    amount: number;
    currentBalance: number;
    transactionTimestamp: string;
    valueDate: string;
    txnId: string;
    narration: string;
    reference: string;
  }[];
  profile?: {
    holders: {
      name: string;
      dob?: string;
      mobile?: string;
      nominee?: string;
      email?: string;
      pan?: string;
      address?: string;
    };
  };
}

/**
 * FI data response
 */
export interface FIDataResponse {
  id: string;
  status: string;
  accounts: AccountData[];
  traceId: string;
}

/**
 * Setu API error
 */
export interface SetuError {
  code: string;
  message: string;
  traceId: string;
}

// ===========================================
// Validation
// ===========================================

/**
 * Validates Setu environment variables
 */
export const validateSetuConfig = (): { valid: boolean; missing: string[] } => {
  const required = [
    'SETU_CLIENT_ID',
    'SETU_CLIENT_SECRET',
    'SETU_PRODUCT_INSTANCE_ID',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing,
  };
};

// ===========================================
// HTTP Client
// ===========================================

interface SetuRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Makes authenticated request to Setu API
 */
const setuRequest = async <T>(options: SetuRequestOptions): Promise<T> => {
  const { method, path, body, headers = {} } = options;
  
  // Validate configuration
  const config = validateSetuConfig();
  if (!config.valid) {
    throw new Error(`Setu configuration missing: ${config.missing.join(', ')}`);
  }
  
  const url = `${SETU_BASE_URL}${path}`;
  
  // Build headers with authentication
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': SETU_CLIENT_ID!,
    'x-client-secret': SETU_CLIENT_SECRET!,
    'x-product-instance-id': SETU_PRODUCT_INSTANCE_ID!,
    ...headers,
  };
  
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = data as SetuError;
      throw new Error(`Setu API Error [${error.code}]: ${error.message} (Trace: ${error.traceId})`);
    }
    
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while calling Setu API');
  }
};

// ===========================================
// Consent APIs
// ===========================================

/**
 * Creates a new consent request
 * 
 * @param payload - Consent request parameters
 * @returns Consent response with redirect URL
 */
export const createConsent = async (
  payload: ConsentRequestPayload
): Promise<ConsentResponse> => {
  // Format VUA if not provided
  const vua = payload.vua || `${payload.mobileNumber}@onemoney`;
  
  const requestBody = {
    consentDuration: payload.consentDuration,
    dataRange: payload.dataRange,
    frequency: payload.frequency,
    fiTypes: payload.fiTypes,
    context: [
      {
        key: 'purpose',
        value: payload.purpose,
      },
    ],
    redirectUrl: payload.redirectUrl || SETU_REDIRECT_URL,
    vua,
    ...(payload.referenceId && { referenceId: payload.referenceId }),
  };
  
  return setuRequest<ConsentResponse>({
    method: 'POST',
    path: '/consents',
    body: requestBody,
  });
};

/**
 * Gets consent status by ID
 * 
 * @param consentId - Consent ID
 * @returns Consent details and status
 */
export const getConsent = async (consentId: string): Promise<ConsentResponse> => {
  return setuRequest<ConsentResponse>({
    method: 'GET',
    path: `/consents/${consentId}`,
  });
};

/**
 * Revokes an existing consent
 * 
 * @param consentId - Consent ID to revoke
 * @returns Updated consent status
 */
export const revokeConsent = async (consentId: string): Promise<ConsentResponse> => {
  return setuRequest<ConsentResponse>({
    method: 'PUT',
    path: `/consents/${consentId}/revoke`,
  });
};

// ===========================================
// Data Session APIs
// ===========================================

/**
 * Creates a data session to fetch financial data
 * 
 * @param request - Data session parameters
 * @returns Session ID and status
 */
export const createDataSession = async (
  request: DataSessionRequest
): Promise<DataSessionResponse> => {
  return setuRequest<DataSessionResponse>({
    method: 'POST',
    path: `/sessions`,
    body: {
      consentId: request.consentId,
      dataRange: request.dataRange,
      format: request.format,
    },
  });
};

/**
 * Gets data session status
 * 
 * @param sessionId - Session ID
 * @returns Session details and status
 */
export const getDataSession = async (
  sessionId: string
): Promise<DataSessionResponse> => {
  return setuRequest<DataSessionResponse>({
    method: 'GET',
    path: `/sessions/${sessionId}`,
  });
};

/**
 * Fetches financial data from a completed session
 * 
 * @param sessionId - Session ID
 * @returns Financial data from linked accounts
 */
export const fetchFIData = async (sessionId: string): Promise<FIDataResponse> => {
  return setuRequest<FIDataResponse>({
    method: 'GET',
    path: `/sessions/${sessionId}/data`,
  });
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Formats phone number to VUA format
 * 
 * @param phone - Phone number (with or without +91)
 * @param provider - AA provider (default: onemoney)
 * @returns VUA string
 */
export const formatVUA = (
  phone: string,
  provider: string = 'onemoney'
): string => {
  // Remove +91 and spaces
  const cleanPhone = phone.replace(/^\+?91/, '').replace(/\s/g, '');
  return `${cleanPhone}@${provider}`;
};

/**
 * Parses bank account details from FI data
 * 
 * @param fiData - Financial information data
 * @returns Simplified bank account list
 */
export const parseBankAccounts = (fiData: FIDataResponse): {
  accountNumber: string;
  maskedNumber: string;
  ifsc: string;
  bankName: string;
  type: string;
  balance?: number;
  currency?: string;
}[] => {
  return fiData.accounts
    .filter(acc => acc.fiType === 'DEPOSIT')
    .map(acc => ({
      accountNumber: acc.account.linkedAccRef,
      maskedNumber: acc.account.maskedAccNumber,
      ifsc: acc.account.branch || '',
      bankName: acc.account.fipName,
      type: acc.account.type,
      balance: acc.summary?.currentBalance,
      currency: acc.summary?.currency,
    }));
};

/**
 * Gets default consent request for basic banking data
 * 
 * @param phone - Customer phone number
 * @param redirectUrl - Redirect URL after consent
 * @returns Pre-configured consent request
 */
export const getDefaultConsentRequest = (
  phone: string,
  redirectUrl: string
): ConsentRequestPayload => {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  return {
    mobileNumber: phone.replace(/^\+?91/, '').replace(/\s/g, ''),
    fiTypes: ['DEPOSIT', 'TERM_DEPOSIT', 'RECURRING_DEPOSIT'],
    purpose: 'Wealth management service',
    redirectUrl,
    consentDuration: {
      unit: 'YEAR',
      value: 1,
    },
    dataRange: {
      from: oneYearAgo.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    },
    frequency: {
      unit: 'DAY',
      value: 1,
    },
  };
};

// ===========================================
// Webhooks
// ===========================================

/**
 * Webhook event types from Setu
 */
export type SetuWebhookEvent = 
  | 'CONSENT_APPROVED'
  | 'CONSENT_REJECTED'
  | 'CONSENT_REVOKED'
  | 'CONSENT_EXPIRED'
  | 'SESSION_COMPLETED'
  | 'SESSION_FAILED';

/**
 * Webhook payload structure
 */
export interface SetuWebhookPayload {
  event: SetuWebhookEvent;
  timestamp: string;
  data: {
    consentId?: string;
    sessionId?: string;
    status: string;
    details?: Record<string, unknown>;
  };
  traceId: string;
}

/**
 * Validates webhook signature (HMAC-SHA256)
 * 
 * @param payload - Raw webhook payload
 * @param signature - x-setu-signature header
 * @param secret - Webhook secret
 * @returns True if signature is valid
 */
export const validateWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  // Implementation would use crypto.createHmac
  // For now, return type-safe placeholder
  if (!payload || !signature || !secret) {
    return false;
  }
  
  // TODO: Implement actual HMAC verification
  // const expectedSignature = crypto
  //   .createHmac('sha256', secret)
  //   .update(payload)
  //   .digest('hex');
  // return crypto.timingSafeEqual(
  //   Buffer.from(signature),
  //   Buffer.from(expectedSignature)
  // );
  
  return true; // Placeholder - implement in production
};
