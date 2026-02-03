/**
 * Razorpay SDK Wrapper
 * 
 * Type-safe wrapper for Razorpay's Payout APIs (RazorpayX).
 * Handles Contact management, Fund Accounts, and Payouts.
 * 
 * API Reference: https://razorpay.com/docs/api/x/
 * 
 * @module lib/razorpay
 */

import crypto from 'crypto';

// ===========================================
// Environment Configuration
// ===========================================

const {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1',
} = process.env;

// ===========================================
// Types
// ===========================================

/**
 * Contact types for RazorpayX
 */
export type ContactType = 'customer' | 'vendor' | 'employee' | 'self';

/**
 * Fund account types
 */
export type FundAccountType = 'bank_account' | 'vpa';

/**
 * Payout modes
 */
export type PayoutMode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'card';

/**
 * Payout purposes (RBI mandated)
 */
export type PayoutPurpose = 
  | 'refund'
  | 'cashback'
  | 'payout'
  | 'salary'
  | 'utility bill'
  | 'vendor bill';

/**
 * Payout status lifecycle
 */
export type PayoutStatus = 
  | 'queued'        // Initial state
  | 'pending'       // Being processed
  | 'processing'    // In transit
  | 'processed'     // Success
  | 'reversed'      // Reversed after processing
  | 'cancelled'     // Cancelled before processing
  | 'rejected'      // Rejected by bank
  | 'failed';       // Failed

/**
 * Contact entity
 */
export interface RazorpayContact {
  id: string;
  entity: 'contact';
  name: string;
  contact: string;        // Phone number
  email: string;
  type: ContactType;
  reference_id: string | null;
  batch_id: string | null;
  active: boolean;
  notes: Record<string, string>;
  created_at: number;
}

/**
 * Bank account details for fund account
 */
export interface BankAccountDetails {
  ifsc: string;
  bank_name: string;
  name: string;
  notes: Record<string, string>;
  account_number: string;
}

/**
 * VPA (UPI) details for fund account
 */
export interface VPADetails {
  username: string;
  handle: string;
  address: string;
}

/**
 * Fund account entity
 */
export interface RazorpayFundAccount {
  id: string;
  entity: 'fund_account';
  contact_id: string;
  account_type: FundAccountType;
  bank_account?: BankAccountDetails;
  vpa?: VPADetails;
  batch_id: string | null;
  active: boolean;
  created_at: number;
}

/**
 * Payout entity
 */
export interface RazorpayPayout {
  id: string;
  entity: 'payout';
  fund_account_id: string;
  fund_account: RazorpayFundAccount;
  amount: number;         // In paise
  currency: 'INR';
  fees: number;
  tax: number;
  status: PayoutStatus;
  purpose: PayoutPurpose;
  utr: string | null;     // Unique Transaction Reference
  mode: PayoutMode;
  reference_id: string | null;
  narration: string | null;
  batch_id: string | null;
  failure_reason: string | null;
  created_at: number;
  fee_type: string | null;
  status_details: {
    source: string;
    reason: string;
    description: string;
  } | null;
}

/**
 * Payout creation request
 */
export interface CreatePayoutRequest {
  account_number: string;   // RazorpayX account number
  fund_account_id: string;
  amount: number;           // In paise
  currency: 'INR';
  mode: PayoutMode;
  purpose: PayoutPurpose;
  queue_if_low_balance?: boolean;
  reference_id?: string;    // Idempotency key
  narration?: string;
  notes?: Record<string, string>;
}

/**
 * Webhook event payload
 */
export interface RazorpayWebhookEvent {
  entity: 'event';
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payout?: { entity: RazorpayPayout };
    fund_account?: { entity: RazorpayFundAccount };
    contact?: { entity: RazorpayContact };
  };
  created_at: number;
}

/**
 * API Error
 */
export interface RazorpayError {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: Record<string, unknown>;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  count?: number;
  skip?: number;
  from?: number;
  to?: number;
}

/**
 * List response wrapper
 */
export interface ListResponse<T> {
  entity: 'collection';
  count: number;
  items: T[];
}

// ===========================================
// Validation
// ===========================================

/**
 * Validates Razorpay environment variables
 */
export const validateRazorpayConfig = (): { valid: boolean; missing: string[] } => {
  const required = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing,
  };
};

// ===========================================
// HTTP Client
// ===========================================

interface RazorpayRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  params?: Record<string, string | number>;
}

/**
 * Makes authenticated request to Razorpay API
 */
const razorpayRequest = async <T>(options: RazorpayRequestOptions): Promise<T> => {
  const { method, path, body, params } = options;
  
  // Validate configuration
  const config = validateRazorpayConfig();
  if (!config.valid) {
    throw new Error(`Razorpay configuration missing: ${config.missing.join(', ')}`);
  }
  
  // Build URL with query params
  let url = `${RAZORPAY_BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }
  
  // Build Basic Auth header
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      const error = data as RazorpayError;
      throw new Error(
        `Razorpay API Error [${error.error.code}]: ${error.error.description} ` +
        `(Reason: ${error.error.reason})`
      );
    }
    
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while calling Razorpay API');
  }
};

// ===========================================
// Contact APIs
// ===========================================

/**
 * Creates a new contact
 * 
 * @param params - Contact details
 * @returns Created contact
 */
export const createContact = async (params: {
  name: string;
  email?: string;
  contact?: string;
  type: ContactType;
  reference_id?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayContact> => {
  return razorpayRequest<RazorpayContact>({
    method: 'POST',
    path: '/contacts',
    body: params,
  });
};

/**
 * Gets a contact by ID
 * 
 * @param contactId - Contact ID
 * @returns Contact details
 */
export const getContact = async (contactId: string): Promise<RazorpayContact> => {
  return razorpayRequest<RazorpayContact>({
    method: 'GET',
    path: `/contacts/${contactId}`,
  });
};

/**
 * Updates a contact
 * 
 * @param contactId - Contact ID
 * @param params - Fields to update
 * @returns Updated contact
 */
export const updateContact = async (
  contactId: string,
  params: Partial<{
    name: string;
    email: string;
    contact: string;
    type: ContactType;
    reference_id: string;
    notes: Record<string, string>;
  }>
): Promise<RazorpayContact> => {
  return razorpayRequest<RazorpayContact>({
    method: 'PATCH',
    path: `/contacts/${contactId}`,
    body: params,
  });
};

/**
 * Activates/deactivates a contact
 * 
 * @param contactId - Contact ID
 * @param active - Active status
 * @returns Updated contact
 */
export const setContactActive = async (
  contactId: string,
  active: boolean
): Promise<RazorpayContact> => {
  return razorpayRequest<RazorpayContact>({
    method: 'PATCH',
    path: `/contacts/${contactId}`,
    body: { active },
  });
};

/**
 * Lists contacts with pagination
 * 
 * @param params - Pagination and filter params
 * @returns List of contacts
 */
export const listContacts = async (
  params?: PaginationParams & { reference_id?: string }
): Promise<ListResponse<RazorpayContact>> => {
  return razorpayRequest<ListResponse<RazorpayContact>>({
    method: 'GET',
    path: '/contacts',
    params: params as Record<string, string | number>,
  });
};

// ===========================================
// Fund Account APIs
// ===========================================

/**
 * Creates a bank account fund account
 * 
 * @param params - Fund account details
 * @returns Created fund account
 */
export const createBankFundAccount = async (params: {
  contact_id: string;
  account_type: 'bank_account';
  bank_account: {
    name: string;
    ifsc: string;
    account_number: string;
  };
}): Promise<RazorpayFundAccount> => {
  return razorpayRequest<RazorpayFundAccount>({
    method: 'POST',
    path: '/fund_accounts',
    body: params,
  });
};

/**
 * Creates a VPA (UPI) fund account
 * 
 * @param params - Fund account details
 * @returns Created fund account
 */
export const createVPAFundAccount = async (params: {
  contact_id: string;
  account_type: 'vpa';
  vpa: {
    address: string;  // UPI VPA (e.g., name@upi)
  };
}): Promise<RazorpayFundAccount> => {
  return razorpayRequest<RazorpayFundAccount>({
    method: 'POST',
    path: '/fund_accounts',
    body: params,
  });
};

/**
 * Gets a fund account by ID
 * 
 * @param fundAccountId - Fund account ID
 * @returns Fund account details
 */
export const getFundAccount = async (
  fundAccountId: string
): Promise<RazorpayFundAccount> => {
  return razorpayRequest<RazorpayFundAccount>({
    method: 'GET',
    path: `/fund_accounts/${fundAccountId}`,
  });
};

/**
 * Activates/deactivates a fund account
 * 
 * @param fundAccountId - Fund account ID
 * @param active - Active status
 * @returns Updated fund account
 */
export const setFundAccountActive = async (
  fundAccountId: string,
  active: boolean
): Promise<RazorpayFundAccount> => {
  return razorpayRequest<RazorpayFundAccount>({
    method: 'PATCH',
    path: `/fund_accounts/${fundAccountId}`,
    body: { active },
  });
};

/**
 * Lists fund accounts for a contact
 * 
 * @param contactId - Contact ID
 * @param params - Pagination params
 * @returns List of fund accounts
 */
export const listFundAccounts = async (
  contactId: string,
  params?: PaginationParams
): Promise<ListResponse<RazorpayFundAccount>> => {
  return razorpayRequest<ListResponse<RazorpayFundAccount>>({
    method: 'GET',
    path: '/fund_accounts',
    params: { contact_id: contactId, ...params } as Record<string, string | number>,
  });
};

// ===========================================
// Payout APIs
// ===========================================

/**
 * Creates a payout with idempotency support
 * 
 * @param params - Payout request
 * @returns Created payout
 */
export const createPayout = async (
  params: CreatePayoutRequest
): Promise<RazorpayPayout> => {
  // Ensure reference_id is set for idempotency
  const requestBody = {
    ...params,
    reference_id: params.reference_id || `payout_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  };
  
  return razorpayRequest<RazorpayPayout>({
    method: 'POST',
    path: '/payouts',
    body: requestBody,
  });
};

/**
 * Gets a payout by ID
 * 
 * @param payoutId - Payout ID
 * @returns Payout details
 */
export const getPayout = async (payoutId: string): Promise<RazorpayPayout> => {
  return razorpayRequest<RazorpayPayout>({
    method: 'GET',
    path: `/payouts/${payoutId}`,
  });
};

/**
 * Cancels a queued payout
 * Only works for payouts in 'queued' status
 * 
 * @param payoutId - Payout ID
 * @returns Cancelled payout
 */
export const cancelPayout = async (payoutId: string): Promise<RazorpayPayout> => {
  return razorpayRequest<RazorpayPayout>({
    method: 'POST',
    path: `/payouts/${payoutId}/cancel`,
  });
};

/**
 * Lists payouts with filters
 * 
 * @param params - Filter and pagination params
 * @returns List of payouts
 */
export const listPayouts = async (
  params?: PaginationParams & {
    fund_account_id?: string;
    reference_id?: string;
    status?: PayoutStatus;
  }
): Promise<ListResponse<RazorpayPayout>> => {
  return razorpayRequest<ListResponse<RazorpayPayout>>({
    method: 'GET',
    path: '/payouts',
    params: params as Record<string, string | number>,
  });
};

/**
 * Gets payout by reference_id (idempotency key)
 * Useful for recovering from network failures
 * 
 * @param referenceId - Reference ID used during creation
 * @returns Payout if found
 */
export const getPayoutByReferenceId = async (
  referenceId: string
): Promise<RazorpayPayout | null> => {
  try {
    const result = await listPayouts({ reference_id: referenceId, count: 1 });
    return result.items.length > 0 ? result.items[0] : null;
  } catch {
    return null;
  }
};

// ===========================================
// Webhook Verification
// ===========================================

/**
 * Verifies Razorpay webhook signature
 * Uses HMAC-SHA256 with timing-safe comparison
 * 
 * @param payload - Raw webhook body (string)
 * @param signature - x-razorpay-signature header
 * @param secret - Webhook secret (optional, uses env if not provided)
 * @returns True if signature is valid
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret?: string
): boolean => {
  const webhookSecret = secret || RAZORPAY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Webhook secret not configured');
  }
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = new Uint8Array(Buffer.from(signature, 'hex'));
    const expectedBuffer = new Uint8Array(Buffer.from(expectedSignature, 'hex'));
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
};

/**
 * Parses and validates webhook event
 * 
 * @param payload - Raw webhook body
 * @param signature - Webhook signature
 * @returns Parsed event or null if invalid
 */
export const parseWebhookEvent = (
  payload: string,
  signature: string
): RazorpayWebhookEvent | null => {
  if (!verifyWebhookSignature(payload, signature)) {
    return null;
  }
  
  try {
    return JSON.parse(payload) as RazorpayWebhookEvent;
  } catch {
    return null;
  }
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Converts rupees to paise
 * Razorpay uses paise (1/100 of rupee)
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

/**
 * Generates idempotency key for payouts
 * Format: {prefix}_{timestamp}_{random}
 * 
 * @param prefix - Optional prefix (default: 'payout')
 * @returns Unique reference ID
 */
export const generateIdempotencyKey = (prefix: string = 'payout'): string => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Determines if a payout status is terminal
 * Terminal states cannot transition further
 * 
 * @param status - Payout status
 * @returns True if terminal state
 */
export const isTerminalStatus = (status: PayoutStatus): boolean => {
  const terminalStatuses: PayoutStatus[] = [
    'processed',
    'reversed',
    'cancelled',
    'rejected',
    'failed',
  ];
  return terminalStatuses.includes(status);
};

/**
 * Determines if a payout can be cancelled
 * Only 'queued' payouts can be cancelled
 * 
 * @param status - Payout status
 * @returns True if can be cancelled
 */
export const canCancelPayout = (status: PayoutStatus): boolean => {
  return status === 'queued';
};

/**
 * Gets recommended payout mode based on amount and urgency
 * 
 * @param amount - Amount in rupees
 * @param urgent - Whether immediate transfer is needed
 * @returns Recommended payout mode
 */
export const getRecommendedPayoutMode = (
  amount: number,
  urgent: boolean = false
): PayoutMode => {
  // UPI has limit of ₹1 lakh per transaction
  if (amount <= 100000 && urgent) {
    return 'UPI';
  }
  
  // IMPS for amounts up to ₹5 lakhs, instant
  if (amount <= 500000 && urgent) {
    return 'IMPS';
  }
  
  // RTGS for amounts ≥ ₹2 lakhs (no upper limit)
  if (amount >= 200000) {
    return 'RTGS';
  }
  
  // NEFT for non-urgent, any amount
  return 'NEFT';
};

/**
 * Payout mode limits (in rupees)
 */
export const PAYOUT_MODE_LIMITS = {
  UPI: { min: 1, max: 100000 },
  IMPS: { min: 1, max: 500000 },
  NEFT: { min: 1, max: Infinity },
  RTGS: { min: 200000, max: Infinity },
} as const;

/**
 * Validates amount for payout mode
 * 
 * @param mode - Payout mode
 * @param amount - Amount in rupees
 * @returns Validation result
 */
export const validatePayoutAmount = (
  mode: PayoutMode,
  amount: number
): { valid: boolean; error?: string } => {
  if (mode === 'card') {
    return { valid: false, error: 'Card payouts not supported' };
  }
  
  const limits = PAYOUT_MODE_LIMITS[mode];
  
  if (amount < limits.min) {
    return { valid: false, error: `Minimum amount for ${mode} is ₹${limits.min}` };
  }
  
  if (amount > limits.max) {
    return { valid: false, error: `Maximum amount for ${mode} is ₹${limits.max}` };
  }
  
  return { valid: true };
};
