/**
 * Razorpay Server Actions
 * 
 * Server actions for Razorpay Contact, Fund Account, and Payout management.
 * Handles the business logic layer between UI and Razorpay SDK.
 * 
 * @module lib/actions/razorpay.actions
 */

'use server';

import { ID, Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite';
import {
  createContact,
  getContact,
  updateContact,
  setContactActive,
  createBankFundAccount,
  createVPAFundAccount,
  getFundAccount,
  setFundAccountActive,
  listFundAccounts,
  createPayout,
  getPayout,
  cancelPayout,
  getPayoutByReferenceId,
  generateIdempotencyKey,
  rupeesToPaise,
  validatePayoutAmount,
  isTerminalStatus,
  canCancelPayout,
  RazorpayContact as RazorpayContactAPI,
  RazorpayFundAccount as RazorpayFundAccountAPI,
  RazorpayPayout as RazorpayPayoutAPI,
  ContactType,
  PayoutMode,
  PayoutPurpose,
} from '@/lib/razorpay';
import { validateIFSC, validateUPI, validatePhone } from '@/lib/validators/indian';
import { parseStringify } from '@/lib/utils';

// ===========================================
// Environment Configuration
// ===========================================

const {
  APPWRITE_DATABASE_ID,
  RAZORPAY_ACCOUNT_NUMBER, // RazorpayX account number for payouts
} = process.env;

// Collection IDs (to be created in Appwrite)
const CONTACTS_COLLECTION = 'razorpay_contacts';
const FUND_ACCOUNTS_COLLECTION = 'razorpay_fund_accounts';
const TRANSACTIONS_COLLECTION = 'transactions_india';

// ===========================================
// Contact Management
// ===========================================

/**
 * Creates a Razorpay contact for a user
 * Also stores the mapping in Appwrite
 * 
 * @param params - Contact creation params
 * @returns Created contact record
 */
export const createRazorpayContact = async (params: {
  userId: string;
  name: string;
  email: string;
  phone: string;
  type?: ContactType;
}): Promise<{ success: boolean; contact?: RazorpayContactRecord; error?: string }> => {
  const { userId, name, email, phone, type = 'customer' } = params;
  
  try {
    // Validate phone number
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.success) {
      return { success: false, error: 'Invalid phone number format. Use +91XXXXXXXXXX' };
    }
    
    // Check if contact already exists for this user
    const { database } = await createAdminClient();
    const existingContacts = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      CONTACTS_COLLECTION,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    
    if (existingContacts.documents.length > 0) {
      return {
        success: true,
        contact: parseStringify(existingContacts.documents[0]) as RazorpayContactRecord,
      };
    }
    
    // Generate reference ID for idempotency
    const referenceId = `contact_${userId}_${Date.now()}`;
    
    // Create contact in Razorpay
    const razorpayContact = await createContact({
      name,
      email,
      contact: phone,
      type,
      reference_id: referenceId,
      notes: { userId },
    });
    
    // Store mapping in Appwrite
    const now = Date.now();
    const contactRecord = await database.createDocument(
      APPWRITE_DATABASE_ID!,
      CONTACTS_COLLECTION,
      ID.unique(),
      {
        userId,
        razorpayContactId: razorpayContact.id,
        name,
        email,
        phone,
        type,
        referenceId,
        active: razorpayContact.active,
        createdAt: now,
        updatedAt: now,
      }
    );
    
    return {
      success: true,
      contact: parseStringify(contactRecord) as RazorpayContactRecord,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create contact';
    return { success: false, error: message };
  }
};

/**
 * Gets or creates a Razorpay contact for a user
 * Ensures user has exactly one active contact
 * 
 * @param userId - User ID
 * @returns Contact record
 */
export const getOrCreateRazorpayContact = async (
  userId: string
): Promise<{ success: boolean; contact?: RazorpayContactRecord; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    // Check for existing contact
    const existingContacts = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      CONTACTS_COLLECTION,
      [Query.equal('userId', userId), Query.limit(1)]
    );
    
    if (existingContacts.documents.length > 0) {
      return {
        success: true,
        contact: parseStringify(existingContacts.documents[0]) as RazorpayContactRecord,
      };
    }
    
    // Get user details to create contact
    const users = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      'users',
      [Query.equal('userId', userId), Query.limit(1)]
    );
    
    if (users.documents.length === 0) {
      return { success: false, error: 'User not found' };
    }
    
    const user = users.documents[0] as unknown as { firstName: string; lastName: string; email: string; phone: string };
    
    // Create new contact
    return createRazorpayContact({
      userId,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get/create contact';
    return { success: false, error: message };
  }
};

/**
 * Updates a Razorpay contact
 * 
 * @param contactRecordId - Appwrite contact record ID
 * @param params - Fields to update
 * @returns Updated contact record
 */
export const updateRazorpayContact = async (
  contactRecordId: string,
  params: Partial<{ name: string; email: string; phone: string }>
): Promise<{ success: boolean; contact?: RazorpayContactRecord; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    // Get existing record
    const record = await database.getDocument(
      APPWRITE_DATABASE_ID!,
      CONTACTS_COLLECTION,
      contactRecordId
    ) as unknown as RazorpayContactRecord;
    
    // Update in Razorpay
    const updateData: Record<string, string> = {};
    if (params.name) updateData.name = params.name;
    if (params.email) updateData.email = params.email;
    if (params.phone) updateData.contact = params.phone;
    
    await updateContact(record.razorpayContactId, updateData);
    
    // Update in Appwrite
    const updatedRecord = await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      CONTACTS_COLLECTION,
      contactRecordId,
      {
        ...params,
        updatedAt: Date.now(),
      }
    );
    
    return {
      success: true,
      contact: parseStringify(updatedRecord) as RazorpayContactRecord,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contact';
    return { success: false, error: message };
  }
};

// ===========================================
// Fund Account Management
// ===========================================

/**
 * Creates a bank account fund account
 * Links user's bank account to Razorpay for payouts
 * 
 * @param params - Fund account details
 * @returns Created fund account record
 */
export const createBankFundAccountForUser = async (params: {
  userId: string;
  bankAccountId: string; // IndianBankAccount.$id
}): Promise<{ success: boolean; fundAccount?: RazorpayFundAccountRecord; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    // Get user's Razorpay contact
    const contactResult = await getOrCreateRazorpayContact(params.userId);
    if (!contactResult.success || !contactResult.contact) {
      return { success: false, error: contactResult.error || 'Failed to get contact' };
    }
    
    // Get bank account details
    const bankAccount = await database.getDocument(
      APPWRITE_DATABASE_ID!,
      'banks_india', // IndianBankAccount collection
      params.bankAccountId
    ) as unknown as IndianBankAccount;
    
    // Validate IFSC
    const ifscValidation = validateIFSC(bankAccount.ifscCode);
    if (!ifscValidation.success) {
      return { success: false, error: 'Invalid IFSC code' };
    }
    
    // Check for existing fund account with same bank account
    const existingFAs = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      [
        Query.equal('userId', params.userId),
        Query.equal('bankAccountId', params.bankAccountId),
        Query.limit(1),
      ]
    );
    
    if (existingFAs.documents.length > 0) {
      return {
        success: true,
        fundAccount: parseStringify(existingFAs.documents[0]) as RazorpayFundAccountRecord,
      };
    }
    
    // Create fund account in Razorpay
    const razorpayFA = await createBankFundAccount({
      contact_id: contactResult.contact.razorpayContactId,
      account_type: 'bank_account',
      bank_account: {
        name: bankAccount.accountHolderName,
        ifsc: bankAccount.ifscCode,
        account_number: bankAccount.accountNumber, // Full account number for creation
      },
    });
    
    // Store mapping in Appwrite
    const now = Date.now();
    const faRecord = await database.createDocument(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      ID.unique(),
      {
        userId: params.userId,
        razorpayFundAccountId: razorpayFA.id,
        razorpayContactId: contactResult.contact.razorpayContactId,
        bankAccountId: params.bankAccountId,
        accountType: 'bank_account',
        accountNumber: bankAccount.accountNumber, // Masked version
        ifsc: bankAccount.ifscCode,
        bankName: bankAccount.bankName,
        accountHolderName: bankAccount.accountHolderName,
        active: razorpayFA.active,
        createdAt: now,
        updatedAt: now,
      }
    );
    
    // Update bank account with Razorpay fund account ID
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      'banks_india',
      params.bankAccountId,
      {
        razorpayFundAccountId: razorpayFA.id,
        razorpayContactId: contactResult.contact.razorpayContactId,
      }
    );
    
    return {
      success: true,
      fundAccount: parseStringify(faRecord) as RazorpayFundAccountRecord,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create fund account';
    return { success: false, error: message };
  }
};

/**
 * Creates a VPA (UPI) fund account
 * 
 * @param params - VPA details
 * @returns Created fund account record
 */
export const createVPAFundAccountForUser = async (params: {
  userId: string;
  vpaAddress: string;
}): Promise<{ success: boolean; fundAccount?: RazorpayFundAccountRecord; error?: string }> => {
  try {
    // Validate VPA
    const vpaValidation = validateUPI(params.vpaAddress);
    if (!vpaValidation.success) {
      return { success: false, error: 'Invalid UPI VPA format' };
    }
    
    const { database } = await createAdminClient();
    
    // Get user's Razorpay contact
    const contactResult = await getOrCreateRazorpayContact(params.userId);
    if (!contactResult.success || !contactResult.contact) {
      return { success: false, error: contactResult.error || 'Failed to get contact' };
    }
    
    // Check for existing fund account with same VPA
    const existingFAs = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      [
        Query.equal('userId', params.userId),
        Query.equal('vpaAddress', params.vpaAddress),
        Query.limit(1),
      ]
    );
    
    if (existingFAs.documents.length > 0) {
      return {
        success: true,
        fundAccount: parseStringify(existingFAs.documents[0]) as RazorpayFundAccountRecord,
      };
    }
    
    // Create fund account in Razorpay
    const razorpayFA = await createVPAFundAccount({
      contact_id: contactResult.contact.razorpayContactId,
      account_type: 'vpa',
      vpa: {
        address: params.vpaAddress,
      },
    });
    
    // Store mapping in Appwrite
    const now = Date.now();
    const faRecord = await database.createDocument(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      ID.unique(),
      {
        userId: params.userId,
        razorpayFundAccountId: razorpayFA.id,
        razorpayContactId: contactResult.contact.razorpayContactId,
        accountType: 'vpa',
        vpaAddress: params.vpaAddress,
        active: razorpayFA.active,
        createdAt: now,
        updatedAt: now,
      }
    );
    
    return {
      success: true,
      fundAccount: parseStringify(faRecord) as RazorpayFundAccountRecord,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create VPA fund account';
    return { success: false, error: message };
  }
};

/**
 * Gets all fund accounts for a user
 * 
 * @param userId - User ID
 * @returns List of fund accounts
 */
export const getUserFundAccounts = async (
  userId: string
): Promise<{ success: boolean; fundAccounts?: RazorpayFundAccountRecord[]; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    const fundAccounts = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      [Query.equal('userId', userId), Query.equal('active', true)]
    );
    
    return {
      success: true,
      fundAccounts: parseStringify(fundAccounts.documents) as RazorpayFundAccountRecord[],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get fund accounts';
    return { success: false, error: message };
  }
};

/**
 * Deactivates a fund account
 * 
 * @param fundAccountRecordId - Appwrite fund account record ID
 * @returns Success status
 */
export const deactivateFundAccount = async (
  fundAccountRecordId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    const record = await database.getDocument(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      fundAccountRecordId
    ) as unknown as RazorpayFundAccountRecord;
    
    // Deactivate in Razorpay
    await setFundAccountActive(record.razorpayFundAccountId, false);
    
    // Update in Appwrite
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      fundAccountRecordId,
      {
        active: false,
        updatedAt: Date.now(),
      }
    );
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate fund account';
    return { success: false, error: message };
  }
};

// ===========================================
// Payout Initiation
// ===========================================

/**
 * Initiates a payout to a fund account
 * Creates transaction record with state machine
 * 
 * @param params - Payout request
 * @returns Payout result with transaction ID
 */
export const initiatePayoutIndia = async (params: {
  userId: string;
  fundAccountRecordId: string;
  amount: number; // In rupees
  mode: PayoutMode;
  purpose: PayoutPurpose;
  narration?: string;
  metadata?: Record<string, unknown>;
}): Promise<CreatePayoutResponse> => {
  const {
    userId,
    fundAccountRecordId,
    amount,
    mode,
    purpose,
    narration,
    metadata,
  } = params;
  
  try {
    // Validate amount for mode
    const amountValidation = validatePayoutAmount(mode, amount);
    if (!amountValidation.valid) {
      return { success: false, error: amountValidation.error };
    }
    
    const { database } = await createAdminClient();
    
    // Get fund account
    const fundAccountRecord = await database.getDocument(
      APPWRITE_DATABASE_ID!,
      FUND_ACCOUNTS_COLLECTION,
      fundAccountRecordId
    ) as unknown as RazorpayFundAccountRecord;
    
    if (!fundAccountRecord.active) {
      return { success: false, error: 'Fund account is not active' };
    }
    
    // Verify fund account belongs to user
    if (fundAccountRecord.userId !== userId) {
      return { success: false, error: 'Fund account does not belong to user' };
    }
    
    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(`payout_${userId}`);
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Create transaction record in 'initiated' state
    const now = Date.now();
    const stateHistory: StateTransition[] = [{
      fromState: 'initiated',
      toState: 'initiated',
      timestamp: now,
      source: 'user',
    }];
    
    const transactionRecord = await database.createDocument(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      ID.unique(),
      {
        userId,
        transactionId,
        idempotencyKey,
        razorpayContactId: fundAccountRecord.razorpayContactId,
        razorpayFundAccountId: fundAccountRecord.razorpayFundAccountId,
        state: 'initiated',
        stateHistory: JSON.stringify(stateHistory),
        type: 'transfer',
        amount: rupeesToPaise(amount),
        currency: 'INR',
        mode,
        purpose,
        beneficiaryName: fundAccountRecord.accountHolderName || fundAccountRecord.vpaAddress || 'Unknown',
        beneficiaryBankAccountId: fundAccountRecord.bankAccountId,
        beneficiaryVpa: fundAccountRecord.vpaAddress,
        narration,
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        updatedAt: now,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      }
    );
    
    // Attempt to create payout in Razorpay
    try {
      const razorpayPayout = await createPayout({
        account_number: RAZORPAY_ACCOUNT_NUMBER!,
        fund_account_id: fundAccountRecord.razorpayFundAccountId,
        amount: rupeesToPaise(amount),
        currency: 'INR',
        mode,
        purpose,
        queue_if_low_balance: true,
        reference_id: idempotencyKey,
        narration: narration || `Payment to ${fundAccountRecord.accountHolderName || fundAccountRecord.vpaAddress}`,
        notes: { transactionId, userId },
      });
      
      // Update transaction with Razorpay payout ID and new state
      const newState = razorpayPayout.status as TransactionState;
      stateHistory.push({
        fromState: 'initiated',
        toState: newState,
        timestamp: Date.now(),
        source: 'system',
        metadata: { razorpayPayoutId: razorpayPayout.id },
      });
      
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        transactionRecord.$id,
        {
          razorpayPayoutId: razorpayPayout.id,
          state: newState,
          previousState: 'initiated',
          stateHistory: JSON.stringify(stateHistory),
          utr: razorpayPayout.utr,
          razorpayFees: razorpayPayout.fees,
          razorpayTax: razorpayPayout.tax,
          submittedAt: Date.now(),
          updatedAt: Date.now(),
        }
      );
      
      return {
        success: true,
        transactionId,
        razorpayPayoutId: razorpayPayout.id,
        state: newState,
      };
    } catch (payoutError) {
      // Update transaction to submitted state (for retry)
      stateHistory.push({
        fromState: 'initiated',
        toState: 'submitted',
        timestamp: Date.now(),
        source: 'system',
        reason: payoutError instanceof Error ? payoutError.message : 'Unknown error',
      });
      
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        transactionRecord.$id,
        {
          state: 'submitted',
          previousState: 'initiated',
          stateHistory: JSON.stringify(stateHistory),
          failureDescription: payoutError instanceof Error ? payoutError.message : 'Unknown error',
          nextRetryAt: now + 60000, // Retry in 1 minute
          updatedAt: Date.now(),
        }
      );
      
      return {
        success: false,
        transactionId,
        state: 'submitted',
        error: payoutError instanceof Error ? payoutError.message : 'Failed to create payout',
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initiate payout';
    return { success: false, error: message };
  }
};

/**
 * Cancels a queued payout
 * 
 * @param transactionId - Transaction ID
 * @returns Success status
 */
export const cancelPayoutIndia = async (
  transactionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    // Find transaction
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [
        Query.equal('transactionId', transactionId),
        Query.equal('userId', userId),
        Query.limit(1),
      ]
    );
    
    if (transactions.documents.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }
    
    const transaction = transactions.documents[0] as unknown as IndianTransaction;
    
    // Check if can be cancelled (only queued payouts)
    const currentState = transaction.state;
    if (currentState !== 'queued') {
      return { success: false, error: `Cannot cancel payout in ${currentState} state` };
    }
    
    if (!transaction.razorpayPayoutId) {
      // Just update local state
      const stateHistory: StateTransition[] = JSON.parse(transaction.stateHistory || '[]');
      stateHistory.push({
        fromState: currentState,
        toState: 'cancelled',
        timestamp: Date.now(),
        source: 'user',
      });
      
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        transaction.$id,
        {
          state: 'cancelled',
          previousState: currentState,
          stateHistory: JSON.stringify(stateHistory),
          updatedAt: Date.now(),
        }
      );
      
      return { success: true };
    }
    
    // Cancel in Razorpay
    await cancelPayout(transaction.razorpayPayoutId);
    
    // Update transaction
    const stateHistory: StateTransition[] = JSON.parse(transaction.stateHistory || '[]');
    stateHistory.push({
      fromState: currentState,
      toState: 'cancelled',
      timestamp: Date.now(),
      source: 'user',
    });
    
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      transaction.$id,
      {
        state: 'cancelled',
        previousState: currentState,
        stateHistory: JSON.stringify(stateHistory),
        updatedAt: Date.now(),
      }
    );
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel payout';
    return { success: false, error: message };
  }
};

/**
 * Gets payout status from Razorpay and syncs with local record
 * 
 * @param transactionId - Transaction ID
 * @returns Current payout status
 */
export const syncPayoutStatus = async (
  transactionId: string
): Promise<{ success: boolean; state?: TransactionState; utr?: string; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    // Find transaction
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [Query.equal('transactionId', transactionId), Query.limit(1)]
    );
    
    if (transactions.documents.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }
    
    const transaction = transactions.documents[0] as unknown as IndianTransaction;
    
    if (!transaction.razorpayPayoutId) {
      return { success: true, state: transaction.state };
    }
    
    // Get current status from Razorpay
    const razorpayPayout = await getPayout(transaction.razorpayPayoutId);
    const razorpayStatus = razorpayPayout.status;
    
    // Map Razorpay status to our TransactionState
    // Razorpay statuses: queued, pending, processing, processed, reversed, cancelled, rejected, failed
    // Our states: initiated, submitted, queued, pending, processing, completed, failed, reversed, cancelled, refund_pending, refund_completed
    let newState: TransactionState;
    switch (razorpayStatus) {
      case 'processed':
        newState = 'completed';
        break;
      case 'rejected':
        // Razorpay 'rejected' maps to our 'failed' state
        newState = 'failed';
        break;
      case 'queued':
        newState = 'queued';
        break;
      case 'pending':
        newState = 'pending';
        break;
      case 'processing':
        newState = 'processing';
        break;
      case 'reversed':
        newState = 'reversed';
        break;
      case 'cancelled':
        newState = 'cancelled';
        break;
      case 'failed':
        newState = 'failed';
        break;
      default:
        newState = transaction.state;
    }
    
    // Check if state changed
    if (newState !== transaction.state) {
      const stateHistory: StateTransition[] = JSON.parse(transaction.stateHistory || '[]');
      stateHistory.push({
        fromState: transaction.state,
        toState: newState,
        timestamp: Date.now(),
        source: 'reconciliation',
      });
      
      const updateData: Record<string, unknown> = {
        state: newState,
        previousState: transaction.state,
        stateHistory: JSON.stringify(stateHistory),
        utr: razorpayPayout.utr,
        razorpayFees: razorpayPayout.fees,
        razorpayTax: razorpayPayout.tax,
        updatedAt: Date.now(),
      };
      
      // Set completion or failure timestamp
      const terminalFailureStates: TransactionState[] = ['failed', 'reversed', 'cancelled'];
      if (newState === 'completed') {
        updateData.completedAt = Date.now();
      } else if (terminalFailureStates.includes(newState)) {
        updateData.failedAt = Date.now();
        if (razorpayPayout.failure_reason) {
          updateData.failureDescription = razorpayPayout.failure_reason;
        }
      }
      
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        transaction.$id,
        updateData
      );
    }
    
    return {
      success: true,
      state: newState,
      utr: razorpayPayout.utr || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync payout status';
    return { success: false, error: message };
  }
};

// ===========================================
// Transaction Queries
// ===========================================

/**
 * Gets user's transactions with filters
 * 
 * @param filters - Query filters
 * @returns List of transactions
 */
export const getUserTransactions = async (
  filters: TransactionFilters
): Promise<{ success: boolean; transactions?: IndianTransaction[]; total?: number; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    const queries: string[] = [];
    
    if (filters.userId) {
      queries.push(Query.equal('userId', filters.userId));
    }
    
    if (filters.state) {
      if (Array.isArray(filters.state)) {
        queries.push(Query.equal('state', filters.state));
      } else {
        queries.push(Query.equal('state', filters.state));
      }
    }
    
    if (filters.type) {
      queries.push(Query.equal('type', filters.type));
    }
    
    if (filters.mode) {
      queries.push(Query.equal('mode', filters.mode));
    }
    
    if (filters.dateFrom) {
      queries.push(Query.greaterThanEqual('createdAt', filters.dateFrom));
    }
    
    if (filters.dateTo) {
      queries.push(Query.lessThanEqual('createdAt', filters.dateTo));
    }
    
    if (filters.minAmount) {
      queries.push(Query.greaterThanEqual('amount', filters.minAmount));
    }
    
    if (filters.maxAmount) {
      queries.push(Query.lessThanEqual('amount', filters.maxAmount));
    }
    
    // Sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';
    queries.push(
      sortOrder === 'desc' 
        ? Query.orderDesc(sortBy) 
        : Query.orderAsc(sortBy)
    );
    
    // Pagination
    queries.push(Query.limit(filters.limit || 25));
    if (filters.offset) {
      queries.push(Query.offset(filters.offset));
    }
    
    const result = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      queries
    );
    
    return {
      success: true,
      transactions: parseStringify(result.documents) as IndianTransaction[],
      total: result.total,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get transactions';
    return { success: false, error: message };
  }
};

/**
 * Gets a single transaction by ID
 * 
 * @param transactionId - Transaction ID
 * @returns Transaction record
 */
export const getTransaction = async (
  transactionId: string
): Promise<{ success: boolean; transaction?: IndianTransaction; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [Query.equal('transactionId', transactionId), Query.limit(1)]
    );
    
    if (transactions.documents.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }
    
    return {
      success: true,
      transaction: parseStringify(transactions.documents[0]) as IndianTransaction,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get transaction';
    return { success: false, error: message };
  }
};
