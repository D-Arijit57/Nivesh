/**
 * Indian Transaction State Machine
 * 
 * Handles transaction state transitions, retry logic, and reconciliation.
 * Implements a finite state machine for Indian payout transactions.
 * 
 * @module lib/actions/transaction-india.actions
 */

'use server';

import { ID, Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite';
import { getPayout, createPayout, rupeesToPaise, generateIdempotencyKey } from '@/lib/razorpay';
import { parseStringify } from '@/lib/utils';

// ===========================================
// Environment Configuration
// ===========================================

const {
  APPWRITE_DATABASE_ID,
  RAZORPAY_ACCOUNT_NUMBER,
} = process.env;

const TRANSACTIONS_COLLECTION = 'transactions_india';
const WEBHOOK_EVENTS_COLLECTION = 'webhook_events';

// ===========================================
// State Machine Configuration
// ===========================================

/**
 * Valid state transitions for transactions
 * Key: current state, Value: array of valid next states
 */
const VALID_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  'initiated': ['submitted', 'queued', 'pending', 'failed', 'cancelled'],
  'submitted': ['queued', 'pending', 'failed', 'cancelled'],
  'queued': ['pending', 'processing', 'cancelled', 'failed'],
  'pending': ['processing', 'completed', 'failed', 'reversed'],
  'processing': ['completed', 'failed', 'reversed'],
  'completed': ['reversed', 'refund_pending'],
  'failed': [], // Terminal state
  'reversed': [], // Terminal state
  'cancelled': [], // Terminal state
  'refund_pending': ['refund_completed', 'failed'],
  'refund_completed': [], // Terminal state
};

/**
 * Terminal states - no further transitions allowed
 */
const TERMINAL_STATES: TransactionState[] = [
  'completed',
  'failed',
  'reversed',
  'cancelled',
  'refund_completed',
];

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 60000, // 1 minute
  maxDelayMs: 3600000, // 1 hour
  backoffMultiplier: 2,
};

// ===========================================
// State Transition Helpers
// ===========================================

/**
 * Checks if a state transition is valid
 * 
 * @param fromState - Current state
 * @param toState - Target state
 * @returns True if transition is valid
 */
export const isValidTransition = (
  fromState: TransactionState,
  toState: TransactionState
): boolean => {
  const validNextStates = VALID_TRANSITIONS[fromState];
  return validNextStates?.includes(toState) ?? false;
};

/**
 * Checks if a state is terminal (no further transitions)
 * 
 * @param state - State to check
 * @returns True if terminal
 */
export const isTerminalState = (state: TransactionState): boolean => {
  return TERMINAL_STATES.includes(state);
};

/**
 * Calculates next retry delay with exponential backoff
 * 
 * @param retryCount - Current retry count
 * @returns Delay in milliseconds
 */
const calculateRetryDelay = (retryCount: number): number => {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
};

// ===========================================
// State Transition Actions
// ===========================================

/**
 * Transitions a transaction to a new state
 * Validates the transition and records history
 * 
 * @param transactionId - Transaction ID
 * @param newState - Target state
 * @param reason - Optional reason for transition
 * @param source - Source of transition
 * @returns Updated transaction or error
 */
export const transitionState = async (params: {
  transactionId: string;
  newState: TransactionState;
  reason?: string;
  source?: 'user' | 'system' | 'webhook' | 'reconciliation';
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; transaction?: IndianTransaction; error?: string }> => {
  const { transactionId, newState, reason, source = 'system', metadata } = params;
  
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
    const currentState = transaction.state;
    
    // Validate transition
    if (!isValidTransition(currentState, newState)) {
      return {
        success: false,
        error: `Invalid state transition from ${currentState} to ${newState}`,
      };
    }
    
    // Build state history entry
    const stateHistory: StateTransition[] = JSON.parse(transaction.stateHistory || '[]');
    stateHistory.push({
      fromState: currentState,
      toState: newState,
      timestamp: Date.now(),
      reason,
      source,
      metadata,
    });
    
    // Build update data
    const updateData: Record<string, unknown> = {
      state: newState,
      previousState: currentState,
      stateHistory: JSON.stringify(stateHistory),
      updatedAt: Date.now(),
    };
    
    // Set timestamps for terminal states
    if (newState === 'completed' || newState === 'refund_completed') {
      updateData.completedAt = Date.now();
    } else if (['failed', 'reversed', 'cancelled'].includes(newState)) {
      updateData.failedAt = Date.now();
      if (reason) {
        updateData.failureDescription = reason;
      }
    }
    
    // Update transaction
    const updated = await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      transaction.$id,
      updateData
    );
    
    return {
      success: true,
      transaction: parseStringify(updated) as IndianTransaction,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to transition state';
    return { success: false, error: message };
  }
};

// ===========================================
// Retry Logic
// ===========================================

/**
 * Gets transactions that need retry
 * 
 * @returns Transactions ready for retry
 */
export const getTransactionsForRetry = async (): Promise<{
  success: boolean;
  transactions?: IndianTransaction[];
  error?: string;
}> => {
  try {
    const { database } = await createAdminClient();
    const now = Date.now();
    
    // Find transactions in retryable states with nextRetryAt <= now
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [
        Query.equal('state', ['submitted', 'failed']),
        Query.lessThanEqual('nextRetryAt', now),
        Query.lessThan('retryCount', RETRY_CONFIG.maxRetries),
        Query.limit(50),
      ]
    );
    
    return {
      success: true,
      transactions: parseStringify(transactions.documents) as IndianTransaction[],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get retry transactions';
    return { success: false, error: message };
  }
};

/**
 * Retries a failed/submitted transaction
 * 
 * @param transactionId - Transaction to retry
 * @returns Retry result
 */
export const retryTransaction = async (
  transactionId: string
): Promise<{ success: boolean; newState?: TransactionState; error?: string }> => {
  try {
    const { database } = await createAdminClient();
    
    // Get transaction
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [Query.equal('transactionId', transactionId), Query.limit(1)]
    );
    
    if (transactions.documents.length === 0) {
      return { success: false, error: 'Transaction not found' };
    }
    
    const transaction = transactions.documents[0] as unknown as IndianTransaction;
    
    // Check if retryable
    if (!['submitted', 'failed'].includes(transaction.state)) {
      return { success: false, error: `Transaction in ${transaction.state} state is not retryable` };
    }
    
    if (transaction.retryCount >= RETRY_CONFIG.maxRetries) {
      return { success: false, error: 'Maximum retry attempts reached' };
    }
    
    // Increment retry count
    const newRetryCount = transaction.retryCount + 1;
    
    // Try to create payout in Razorpay
    try {
      const razorpayPayout = await createPayout({
        account_number: RAZORPAY_ACCOUNT_NUMBER!,
        fund_account_id: transaction.razorpayFundAccountId!,
        amount: transaction.amount,
        currency: 'INR',
        mode: transaction.mode,
        purpose: transaction.purpose,
        queue_if_low_balance: true,
        reference_id: transaction.idempotencyKey,
        narration: transaction.narration || undefined,
        notes: { transactionId, retry: String(newRetryCount) },
      });
      
      // Update transaction with new payout ID and state
      const newState = razorpayPayout.status === 'processed' ? 'completed' : 
                       razorpayPayout.status as TransactionState;
      
      const stateHistory: StateTransition[] = JSON.parse(transaction.stateHistory || '[]');
      stateHistory.push({
        fromState: transaction.state,
        toState: newState,
        timestamp: Date.now(),
        source: 'system',
        reason: `Retry ${newRetryCount}`,
        metadata: { razorpayPayoutId: razorpayPayout.id },
      });
      
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        transaction.$id,
        {
          razorpayPayoutId: razorpayPayout.id,
          state: newState,
          previousState: transaction.state,
          stateHistory: JSON.stringify(stateHistory),
          retryCount: newRetryCount,
          utr: razorpayPayout.utr,
          razorpayFees: razorpayPayout.fees,
          razorpayTax: razorpayPayout.tax,
          updatedAt: Date.now(),
          ...(newState === 'completed' ? { completedAt: Date.now() } : {}),
        }
      );
      
      return { success: true, newState };
    } catch (payoutError) {
      // Update retry count and schedule next retry
      const nextRetryAt = Date.now() + calculateRetryDelay(newRetryCount);
      const failedPermanently = newRetryCount >= RETRY_CONFIG.maxRetries;
      
      const stateHistory: StateTransition[] = JSON.parse(transaction.stateHistory || '[]');
      stateHistory.push({
        fromState: transaction.state,
        toState: failedPermanently ? 'failed' : transaction.state,
        timestamp: Date.now(),
        source: 'system',
        reason: `Retry ${newRetryCount} failed: ${payoutError instanceof Error ? payoutError.message : 'Unknown error'}`,
      });
      
      await database.updateDocument(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        transaction.$id,
        {
          retryCount: newRetryCount,
          nextRetryAt: failedPermanently ? null : nextRetryAt,
          state: failedPermanently ? 'failed' : transaction.state,
          stateHistory: JSON.stringify(stateHistory),
          failureDescription: payoutError instanceof Error ? payoutError.message : 'Unknown error',
          updatedAt: Date.now(),
          ...(failedPermanently ? { failedAt: Date.now() } : {}),
        }
      );
      
      return {
        success: false,
        newState: failedPermanently ? 'failed' : undefined,
        error: payoutError instanceof Error ? payoutError.message : 'Retry failed',
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retry transaction';
    return { success: false, error: message };
  }
};

/**
 * Process all pending retries
 * Should be called by a cron job
 * 
 * @returns Processing results
 */
export const processRetries = async (): Promise<{
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors?: string[];
}> => {
  const errors: string[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  try {
    const result = await getTransactionsForRetry();
    
    if (!result.success || !result.transactions) {
      return {
        success: false,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [result.error || 'Failed to get retry transactions'],
      };
    }
    
    for (const transaction of result.transactions) {
      processed++;
      const retryResult = await retryTransaction(transaction.transactionId);
      
      if (retryResult.success) {
        succeeded++;
      } else {
        failed++;
        errors.push(`${transaction.transactionId}: ${retryResult.error}`);
      }
    }
    
    return {
      success: true,
      processed,
      succeeded,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      processed,
      succeeded,
      failed,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
};

// ===========================================
// Reconciliation
// ===========================================

/**
 * Reconciles a transaction with Razorpay status
 * 
 * @param transactionId - Transaction to reconcile
 * @returns Reconciliation result
 */
export const reconcileTransaction = async (
  transactionId: string
): Promise<ReconciliationResult> => {
  try {
    const { database } = await createAdminClient();
    
    // Get transaction
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [Query.equal('transactionId', transactionId), Query.limit(1)]
    );
    
    if (transactions.documents.length === 0) {
      return {
        transactionId,
        previousState: 'initiated', // placeholder
        newState: 'initiated',
        source: 'razorpay_sync',
        reconciled: false,
        discrepancy: 'Transaction not found',
      };
    }
    
    const transaction = transactions.documents[0] as unknown as IndianTransaction;
    const previousState = transaction.state;
    
    // If no Razorpay payout ID, nothing to reconcile
    if (!transaction.razorpayPayoutId) {
      return {
        transactionId,
        previousState,
        newState: previousState,
        source: 'razorpay_sync',
        reconciled: true,
        discrepancy: 'No Razorpay payout ID - local only',
      };
    }
    
    // Get status from Razorpay
    const razorpayPayout = await getPayout(transaction.razorpayPayoutId);
    
    // Map Razorpay status to our state
    let razorpayState: TransactionState;
    switch (razorpayPayout.status) {
      case 'processed':
        razorpayState = 'completed';
        break;
      case 'rejected':
        razorpayState = 'failed';
        break;
      default:
        razorpayState = razorpayPayout.status as TransactionState;
    }
    
    // Check for discrepancy
    if (razorpayState === previousState) {
      return {
        transactionId,
        previousState,
        newState: previousState,
        source: 'razorpay_sync',
        reconciled: true,
      };
    }
    
    // Update state if valid transition
    if (isValidTransition(previousState, razorpayState)) {
      const result = await transitionState({
        transactionId,
        newState: razorpayState,
        reason: `Reconciled from Razorpay status: ${razorpayPayout.status}`,
        source: 'reconciliation',
        metadata: {
          razorpayStatus: razorpayPayout.status,
          utr: razorpayPayout.utr,
          failure_reason: razorpayPayout.failure_reason,
        },
      });
      
      return {
        transactionId,
        previousState,
        newState: razorpayState,
        source: 'razorpay_sync',
        reconciled: result.success,
        discrepancy: result.success 
          ? `State updated from ${previousState} to ${razorpayState}`
          : result.error,
      };
    }
    
    // Invalid transition - mark as discrepancy
    return {
      transactionId,
      previousState,
      newState: previousState, // Keep current state
      source: 'razorpay_sync',
      reconciled: false,
      discrepancy: `Invalid transition from ${previousState} to ${razorpayState} (Razorpay: ${razorpayPayout.status})`,
    };
  } catch (error) {
    return {
      transactionId,
      previousState: 'initiated',
      newState: 'initiated',
      source: 'razorpay_sync',
      reconciled: false,
      discrepancy: error instanceof Error ? error.message : 'Reconciliation failed',
    };
  }
};

/**
 * Reconciles all pending/processing transactions
 * Should be run periodically to catch webhook misses
 * 
 * @returns Reconciliation summary
 */
export const reconcileAllPending = async (): Promise<{
  success: boolean;
  total: number;
  reconciled: number;
  discrepancies: number;
  results?: ReconciliationResult[];
  error?: string;
}> => {
  try {
    const { database } = await createAdminClient();
    
    // Get all non-terminal transactions with Razorpay IDs
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [
        Query.equal('state', ['submitted', 'queued', 'pending', 'processing']),
        Query.isNotNull('razorpayPayoutId'),
        Query.limit(100),
      ]
    );
    
    const results: ReconciliationResult[] = [];
    let reconciled = 0;
    let discrepancies = 0;
    
    for (const doc of transactions.documents) {
      const transaction = doc as unknown as IndianTransaction;
      const result = await reconcileTransaction(transaction.transactionId);
      results.push(result);
      
      if (result.reconciled) {
        reconciled++;
      } else {
        discrepancies++;
      }
    }
    
    return {
      success: true,
      total: transactions.documents.length,
      reconciled,
      discrepancies,
      results,
    };
  } catch (error) {
    return {
      success: false,
      total: 0,
      reconciled: 0,
      discrepancies: 0,
      error: error instanceof Error ? error.message : 'Reconciliation failed',
    };
  }
};

// ===========================================
// Statistics & Reporting
// ===========================================

/**
 * Gets transaction statistics for a user
 * 
 * @param userId - User ID
 * @returns Transaction statistics
 */
export const getTransactionStats = async (
  userId: string
): Promise<{
  success: boolean;
  stats?: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalAmount: number;
    completedAmount: number;
  };
  error?: string;
}> => {
  try {
    const { database } = await createAdminClient();
    
    // Get all user transactions
    const transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [Query.equal('userId', userId)]
    );
    
    const docs = transactions.documents as unknown as IndianTransaction[];
    
    const stats = {
      total: docs.length,
      completed: 0,
      pending: 0,
      failed: 0,
      totalAmount: 0,
      completedAmount: 0,
    };
    
    for (const tx of docs) {
      stats.totalAmount += tx.amount;
      
      if (tx.state === 'completed' || tx.state === 'refund_completed') {
        stats.completed++;
        stats.completedAmount += tx.amount;
      } else if (['failed', 'reversed', 'cancelled'].includes(tx.state)) {
        stats.failed++;
      } else {
        stats.pending++;
      }
    }
    
    return { success: true, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get stats';
    return { success: false, error: message };
  }
};
