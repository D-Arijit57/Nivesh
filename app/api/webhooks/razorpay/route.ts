/**
 * Razorpay Webhook Handler
 * 
 * Handles Razorpay webhook events for payout status updates.
 * Implements idempotent processing with event deduplication.
 * 
 * @module app/api/webhooks/razorpay/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite';
import { verifyWebhookSignature, RazorpayWebhookEvent } from '@/lib/razorpay';
import { transitionState, isValidTransition } from '@/lib/actions/transaction-india.actions';
import crypto from 'crypto';

// ===========================================
// Environment Configuration
// ===========================================

const { APPWRITE_DATABASE_ID } = process.env;

const TRANSACTIONS_COLLECTION = 'transactions_india';
const WEBHOOK_EVENTS_COLLECTION = 'webhook_events';

// ===========================================
// Webhook Event Types
// ===========================================

/**
 * Payout webhook event types
 */
const PAYOUT_EVENTS = [
  'payout.queued',
  'payout.pending',
  'payout.processing',
  'payout.processed',
  'payout.reversed',
  'payout.cancelled',
  'payout.rejected',
  'payout.failed',
] as const;

type PayoutEventType = typeof PAYOUT_EVENTS[number];

// ===========================================
// Main Webhook Handler
// ===========================================

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Get signature from header
    const signature = request.headers.get('x-razorpay-signature');
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 400 }
      );
    }
    
    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Parse event payload
    const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    
    // Generate event ID for deduplication
    const eventId = generateEventId(event);
    
    // Check for duplicate event
    const { database } = await createAdminClient();
    const existingEvents = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      WEBHOOK_EVENTS_COLLECTION,
      [Query.equal('eventId', eventId), Query.limit(1)]
    );
    
    if (existingEvents.documents.length > 0) {
      // Event already processed - idempotent response
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        eventId,
      });
    }
    
    // Create event record (before processing for idempotency)
    const eventRecord = await database.createDocument(
      APPWRITE_DATABASE_ID!,
      WEBHOOK_EVENTS_COLLECTION,
      ID.unique(),
      {
        eventId,
        eventType: event.event,
        payloadHash: hashPayload(rawBody),
        processed: false,
        createdAt: Date.now(),
      }
    );
    
    // Process the event
    let processingResult: { success: boolean; transactionId?: string; error?: string };
    
    if (isPayoutEvent(event.event)) {
      processingResult = await processPayoutEvent(event);
    } else {
      processingResult = { success: true }; // Ignore unhandled events
    }
    
    // Update event record with processing result
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      WEBHOOK_EVENTS_COLLECTION,
      eventRecord.$id,
      {
        processed: processingResult.success,
        processedAt: Date.now(),
        transactionId: processingResult.transactionId,
        error: processingResult.error,
      }
    );
    
    if (!processingResult.success) {
      // Return success anyway to prevent Razorpay retries
      // We'll handle retries internally via reconciliation
      return NextResponse.json({
        success: true,
        message: 'Event received but processing failed',
        error: processingResult.error,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Event processed successfully',
      eventId,
      transactionId: processingResult.transactionId,
    });
  } catch (error) {
    // Log error but return success to prevent Razorpay retries
    // Handle via reconciliation instead
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: true,
      message: 'Event received but an error occurred',
      error: message,
    });
  }
}

// ===========================================
// Event Processing Functions
// ===========================================

/**
 * Checks if event is a payout event
 */
function isPayoutEvent(eventType: string): eventType is PayoutEventType {
  return PAYOUT_EVENTS.includes(eventType as PayoutEventType);
}

/**
 * Processes a payout webhook event
 * 
 * @param event - Webhook event
 * @returns Processing result
 */
async function processPayoutEvent(
  event: RazorpayWebhookEvent
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const payout = event.payload.payout?.entity;
    
    if (!payout) {
      return { success: false, error: 'No payout entity in event' };
    }
    
    const { database } = await createAdminClient();
    
    // Find transaction by Razorpay payout ID or reference ID
    let transactions = await database.listDocuments(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      [Query.equal('razorpayPayoutId', payout.id), Query.limit(1)]
    );
    
    // Fallback to reference ID (idempotency key)
    if (transactions.documents.length === 0 && payout.reference_id) {
      transactions = await database.listDocuments(
        APPWRITE_DATABASE_ID!,
        TRANSACTIONS_COLLECTION,
        [Query.equal('idempotencyKey', payout.reference_id), Query.limit(1)]
      );
    }
    
    if (transactions.documents.length === 0) {
      return {
        success: false,
        error: `Transaction not found for payout ${payout.id}`,
      };
    }
    
    const transaction = transactions.documents[0] as unknown as IndianTransaction;
    
    // Map Razorpay status to our state
    const newState = mapPayoutStatusToState(payout.status);
    
    // Check if state change is needed
    if (newState === transaction.state) {
      return {
        success: true,
        transactionId: transaction.transactionId,
      };
    }
    
    // Validate and perform state transition
    if (!isValidTransition(transaction.state, newState)) {
      return {
        success: false,
        transactionId: transaction.transactionId,
        error: `Invalid transition from ${transaction.state} to ${newState}`,
      };
    }
    
    // Build metadata from payout
    const metadata: Record<string, unknown> = {
      razorpayPayoutId: payout.id,
      razorpayStatus: payout.status,
    };
    
    if (payout.utr) {
      metadata.utr = payout.utr;
    }
    
    if (payout.failure_reason) {
      metadata.failureReason = payout.failure_reason;
    }
    
    if (payout.status_details) {
      metadata.statusDetails = payout.status_details;
    }
    
    // Transition the state
    const result = await transitionState({
      transactionId: transaction.transactionId,
      newState,
      reason: `Webhook: ${event.event}`,
      source: 'webhook',
      metadata,
    });
    
    if (!result.success) {
      return {
        success: false,
        transactionId: transaction.transactionId,
        error: result.error,
      };
    }
    
    // Update additional fields from payout
    await database.updateDocument(
      APPWRITE_DATABASE_ID!,
      TRANSACTIONS_COLLECTION,
      transaction.$id,
      {
        razorpayPayoutId: payout.id,
        utr: payout.utr,
        razorpayFees: payout.fees,
        razorpayTax: payout.tax,
        ...(payout.failure_reason ? { failureDescription: payout.failure_reason } : {}),
      }
    );
    
    return {
      success: true,
      transactionId: transaction.transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process payout event',
    };
  }
}

/**
 * Maps Razorpay payout status to our transaction state
 * 
 * @param status - Razorpay payout status
 * @returns Transaction state
 */
function mapPayoutStatusToState(status: string): TransactionState {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'processed':
      return 'completed';
    case 'reversed':
      return 'reversed';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
    case 'failed':
      return 'failed';
    default:
      return 'pending'; // Default to pending for unknown states
  }
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Generates a unique event ID for deduplication
 * Uses account_id + event_type + payout_id + created_at
 * 
 * @param event - Webhook event
 * @returns Unique event ID
 */
function generateEventId(event: RazorpayWebhookEvent): string {
  const parts = [
    event.account_id,
    event.event,
    event.payload.payout?.entity.id || 'unknown',
    event.created_at.toString(),
  ];
  
  return crypto
    .createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .slice(0, 32);
}

/**
 * Hashes payload for audit/debugging
 * 
 * @param payload - Raw payload string
 * @returns SHA-256 hash
 */
function hashPayload(payload: string): string {
  return crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
}

// ===========================================
// Additional HTTP Methods
// ===========================================

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Razorpay webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
