/* eslint-disable no-unused-vars */

// ========================================
// Indian KYC Types
// ========================================

/**
 * KYC Status Enum
 * - pending: KYC submitted but not verified
 * - verified: KYC successfully verified
 * - rejected: KYC verification failed
 * - expired: KYC verification expired, needs re-verification
 */
declare type KYCStatus = 'pending' | 'verified' | 'rejected' | 'expired';

declare type IndianKYC = {
  pan?: string;           // Encrypted PAN number
  panMasked?: string;     // Masked PAN: ABCDE****F (5 chars + 4 asterisks + 1 char)
  aadhaarHash?: string;   // SHA-256 hash (never store raw Aadhaar)
  aadhaarLast4?: string;  // Masked: XXXX-XXXX-1234
  upiId?: string;         // UPI VPA (e.g., name@upi)
  kycVerified: boolean;   // Deprecated: use kycStatus instead
  kycStatus: KYCStatus;   // Current KYC verification status
  kycVerifiedAt?: string;
  kycRejectedReason?: string;
};

declare type SignUpParamsIndia = {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;          // Indian state code
  postalCode: string;     // 6-digit PIN code
  dateOfBirth: string;    // DD-MM-YYYY format
  phone: string;          // +91XXXXXXXXXX format
  email: string;
  password: string;
  // KYC fields (at least one required)
  pan?: string;
  aadhaar?: string;
  upiId?: string;
};

declare type UserIndia = {
  $id: string;
  email: string;
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  phone: string;
  // Indian KYC fields
  panMasked?: string;     // Masked PAN: ABCDE****F
  aadhaarHash?: string;
  aadhaarLast4?: string;
  upiId?: string;
  kycVerified: boolean;   // Deprecated: use kycStatus
  kycStatus: KYCStatus;
  kycVerifiedAt?: string;
  kycRejectedReason?: string;
  // Payment provider IDs (Phase 2-3)
  setuConsentId?: string;
  razorpayCustomerId?: string;
  razorpayFundAccountId?: string;
};

// ========================================
// OTP Types
// ========================================

declare type OTPPurpose = 
  | 'sign-up'
  | 'login'
  | 'transaction'
  | 'kyc-verification'
  | 'password-reset';

declare type OTPRequest = {
  phone: string;          // +91XXXXXXXXXX format
  purpose: OTPPurpose;
  userId?: string;        // Optional for sign-up
};

declare type OTPVerify = {
  phone: string;
  otp: string;
  purpose: OTPPurpose;
  userId?: string;
};

/**
 * OTP Record stored in Appwrite
 * Uses integer timestamps for efficient indexing
 */
declare type OTPRecord = {
  $id: string;
  phone: string;
  otpHash: string;        // HMAC-SHA256 hash
  purpose: OTPPurpose;
  expiresAt: number;      // Unix timestamp (milliseconds)
  attempts: number;
  verified: boolean;
  userId?: string;
  createdAt: number;      // Unix timestamp (milliseconds)
};

declare type OTPResponse = {
  success: boolean;
  message: string;
  expiresIn?: number;     // Seconds until expiry
  attemptsRemaining?: number;
};

// ========================================
// Indian Bank Account Types (Phase 2)
// ========================================

declare type IndianBankAccount = {
  $id: string;
  userId: string;
  accountNumber: string;  // Masked: XXXX1234
  ifscCode: string;
  bankName: string;
  accountHolderName: string;
  accountType: 'savings' | 'current';
  upiId?: string;
  // Setu AA fields
  setuConsentId?: string;
  setuAccountLinkId?: string;
  // Razorpay fields
  razorpayFundAccountId?: string;
  razorpayContactId?: string;
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: string;
};

declare type UPITransaction = {
  $id: string;
  transactionId: string;  // UPI transaction reference
  upiRefId?: string;      // RRN (Retrieval Reference Number)
  senderVpa: string;
  receiverVpa: string;
  amount: number;
  currency: 'INR';
  status: 'pending' | 'success' | 'failed' | 'refunded';
  purpose: string;
  remarks?: string;
  createdAt: string;
  completedAt?: string;
};

// ========================================
// Setu Account Aggregator Types (Phase 2)
// ========================================

/**
 * Financial Information Types supported by RBI AA framework
 */
declare type SetuFIType = 
  | 'DEPOSIT'
  | 'TERM_DEPOSIT'
  | 'RECURRING_DEPOSIT'
  | 'SIP'
  | 'MUTUAL_FUNDS'
  | 'INSURANCE_POLICIES'
  | 'NPS'
  | 'EQUITIES'
  | 'BONDS';

declare type SetuConsentPurpose = 
  | 'Wealth management service'
  | 'Customer spending patterns, currentbalance or aggregatedstatement'
  | 'Aggregated statement'
  | 'Explicit consent for monitoring of the accounts';

declare type SetuConsentRequest = {
  userId: string;
  phone: string;
  purpose: SetuConsentPurpose;
  fiTypes: SetuFIType[];
  redirectUrl?: string;
  referenceId?: string;
};

declare type SetuConsentStatus = 
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'PAUSED';

declare type SetuSessionStatus = 
  | 'PENDING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'FAILED';

declare type SetuConsent = {
  consentId: string;
  consentHandle: string;
  status: SetuConsentStatus;
  redirectUrl?: string;
  vua?: string;
  createdAt: string;
  expiresAt: string;
  fiTypes: SetuFIType[];
  usageCount: number;
  lastUsed?: string;
};

/**
 * Setu consent record stored in Appwrite
 */
declare type SetuConsentRecord = {
  $id: string;
  userId: string;
  consentId: string;
  status: SetuConsentStatus;
  vua: string;
  fiTypes: string;        // JSON stringified array
  redirectUrl: string;
  referenceId?: string;
  createdAt: number;      // Unix timestamp
  expiresAt: number;      // Unix timestamp
  approvedAt?: number;
  revokedAt?: number;
};

declare type SetuDataSession = {
  sessionId: string;
  consentId: string;
  status: SetuSessionStatus;
  format: 'json' | 'xml';
  dataRange: {
    from: string;
    to: string;
  };
  createdAt: string;
};

declare type SetuAccountData = {
  fiType: SetuFIType;
  accountType: string;
  maskedAccountNumber: string;
  fipId: string;
  fipName: string;
  linkedAccounts: {
    accountNumber: string;
    ifsc: string;
    bankName: string;
    branch?: string;
  }[];
  summary?: {
    currentBalance: number;
    currency: string;
    status: string;
  };
  holder?: {
    name: string;
    mobile?: string;
    email?: string;
    pan?: string;
  };
};

/**
 * Bank account discovered via Setu AA
 */
declare type SetuDiscoveredAccount = {
  accountNumber: string;
  maskedNumber: string;
  ifsc: string;
  bankName: string;
  fipId: string;
  accountType: 'savings' | 'current' | 'term_deposit' | 'recurring_deposit';
  holderName?: string;
  balance?: number;
  currency?: string;
};

// ========================================
// Razorpay Types (Phase 3)
// ========================================

/**
 * Razorpay contact types
 */
declare type RazorpayContactType = 'customer' | 'vendor' | 'employee' | 'self';

/**
 * Razorpay fund account types
 */
declare type RazorpayFundAccountType = 'bank_account' | 'vpa';

/**
 * Razorpay payout modes
 */
declare type RazorpayPayoutMode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI';

/**
 * Razorpay payout purposes (RBI mandated)
 */
declare type RazorpayPayoutPurpose = 
  | 'refund'
  | 'cashback'
  | 'payout'
  | 'salary'
  | 'utility bill'
  | 'vendor bill';

/**
 * Payout status lifecycle
 * @see https://razorpay.com/docs/api/x/payouts/#payout-life-cycle
 */
declare type RazorpayPayoutStatus = 
  | 'queued'        // Initial state, waiting to be processed
  | 'pending'       // Being processed by Razorpay
  | 'processing'    // Sent to bank, in transit
  | 'processed'     // Successfully completed
  | 'reversed'      // Reversed after processing (bank returned)
  | 'cancelled'     // Cancelled before processing
  | 'rejected'      // Rejected by bank
  | 'failed';       // Failed

/**
 * Razorpay contact entity
 */
declare type RazorpayContact = {
  id: string;
  entity: 'contact';
  name: string;
  email: string;
  contact: string;        // Phone number
  type: RazorpayContactType;
  reference_id: string | null;
  batch_id: string | null;
  active: boolean;
  notes: Record<string, string>;
  created_at: number;
};

/**
 * Razorpay fund account entity
 */
declare type RazorpayFundAccount = {
  id: string;
  entity: 'fund_account';
  contact_id: string;
  account_type: RazorpayFundAccountType;
  bank_account?: {
    ifsc: string;
    bank_name: string;
    name: string;
    notes: Record<string, string>;
    account_number: string;
  };
  vpa?: {
    username: string;
    handle: string;
    address: string;      // Full UPI VPA
  };
  batch_id: string | null;
  active: boolean;
  created_at: number;
};

/**
 * Razorpay payout entity
 */
declare type RazorpayPayout = {
  id: string;
  entity: 'payout';
  fund_account_id: string;
  fund_account: RazorpayFundAccount;
  amount: number;         // In paise (₹1 = 100 paise)
  currency: 'INR';
  fees: number;
  tax: number;
  status: RazorpayPayoutStatus;
  purpose: RazorpayPayoutPurpose;
  utr: string | null;     // Unique Transaction Reference (bank ref)
  mode: RazorpayPayoutMode;
  reference_id: string | null;  // Idempotency key
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
};

/**
 * Contact record stored in Appwrite (razorpay_contacts collection)
 */
declare type RazorpayContactRecord = {
  $id: string;
  userId: string;
  razorpayContactId: string;
  name: string;
  email: string;
  phone: string;
  type: RazorpayContactType;
  referenceId: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

/**
 * Fund account record stored in Appwrite (razorpay_fund_accounts collection)
 */
declare type RazorpayFundAccountRecord = {
  $id: string;
  userId: string;
  razorpayFundAccountId: string;
  razorpayContactId: string;
  bankAccountId?: string; // Link to IndianBankAccount
  accountType: RazorpayFundAccountType;
  // For bank accounts
  accountNumber?: string; // Masked
  ifsc?: string;
  bankName?: string;
  accountHolderName?: string;
  // For VPA
  vpaAddress?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

// ========================================
// Indian Transaction Types (Phase 3)
// ========================================

/**
 * Transaction state machine states
 */
declare type TransactionState = 
  | 'initiated'     // Transaction created, not yet submitted
  | 'submitted'     // Submitted to Razorpay
  | 'queued'        // Razorpay accepted, waiting
  | 'pending'       // Being processed
  | 'processing'    // In transit to bank
  | 'completed'     // Successfully processed
  | 'failed'        // Permanently failed
  | 'reversed'      // Reversed after completion
  | 'cancelled'     // Cancelled before processing
  | 'refund_pending'   // Refund initiated
  | 'refund_completed'; // Refund successful

/**
 * Transaction type
 */
declare type TransactionType = 
  | 'transfer'      // P2P transfer
  | 'payment'       // Bill/merchant payment
  | 'refund'        // Refund of previous payment
  | 'cashback'      // Promotional cashback
  | 'salary';       // Salary disbursement

/**
 * Transaction failure reasons
 */
declare type TransactionFailureReason = 
  | 'insufficient_balance'
  | 'invalid_beneficiary'
  | 'beneficiary_bank_down'
  | 'beneficiary_account_closed'
  | 'beneficiary_name_mismatch'
  | 'limit_exceeded'
  | 'payout_rejected'
  | 'compliance_rejection'
  | 'network_error'
  | 'timeout'
  | 'unknown';

/**
 * Indian transaction record stored in Appwrite
 */
declare type IndianTransaction = {
  $id: string;
  userId: string;
  
  // Transaction identity
  transactionId: string;      // Internal unique ID
  idempotencyKey: string;     // For duplicate prevention
  
  // Razorpay references
  razorpayPayoutId?: string;
  razorpayContactId?: string;
  razorpayFundAccountId?: string;
  
  // State machine
  state: TransactionState;
  previousState?: TransactionState;
  stateHistory: string;       // JSON array of state transitions
  
  // Transaction details
  type: TransactionType;
  amount: number;             // In paise
  currency: 'INR';
  mode: RazorpayPayoutMode;
  purpose: RazorpayPayoutPurpose;
  
  // Beneficiary info
  beneficiaryName: string;
  beneficiaryBankAccountId?: string;
  beneficiaryVpa?: string;
  
  // Bank references
  utr?: string;               // Bank transaction reference
  narration?: string;
  
  // Fees
  razorpayFees?: number;      // In paise
  razorpayTax?: number;       // In paise
  
  // Failure handling
  failureReason?: TransactionFailureReason;
  failureDescription?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;       // Unix timestamp
  
  // Timestamps
  createdAt: number;          // Unix timestamp
  updatedAt: number;          // Unix timestamp
  submittedAt?: number;
  completedAt?: number;
  failedAt?: number;
  
  // Metadata
  metadata?: string;          // JSON for additional data
};

/**
 * State transition event
 */
declare type StateTransition = {
  fromState: TransactionState;
  toState: TransactionState;
  timestamp: number;
  reason?: string;
  source?: 'user' | 'system' | 'webhook' | 'reconciliation';
  metadata?: Record<string, unknown>;
};

/**
 * Webhook event record for idempotent processing
 */
declare type WebhookEventRecord = {
  $id: string;
  eventId: string;            // Razorpay event ID
  eventType: string;          // e.g., 'payout.processed'
  payloadHash: string;        // For deduplication
  processed: boolean;
  processedAt?: number;
  transactionId?: string;     // Linked transaction
  error?: string;
  createdAt: number;
};

/**
 * Create payout request from UI
 */
declare type CreatePayoutRequest = {
  userId: string;
  amount: number;             // In rupees (will be converted to paise)
  mode: RazorpayPayoutMode;
  purpose: RazorpayPayoutPurpose;
  
  // Destination (one of these)
  fundAccountId?: string;     // Existing fund account
  bankAccountId?: string;     // Bank account from user's linked accounts
  vpaAddress?: string;        // UPI VPA for direct transfer
  
  narration?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Payout response
 */
declare type CreatePayoutResponse = {
  success: boolean;
  transactionId?: string;
  razorpayPayoutId?: string;
  state?: TransactionState;
  error?: string;
  errorCode?: string;
};

/**
 * Transaction query filters
 */
declare type TransactionFilters = {
  userId?: string;
  state?: TransactionState | TransactionState[];
  type?: TransactionType;
  mode?: RazorpayPayoutMode;
  dateFrom?: number;
  dateTo?: number;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'amount' | 'state';
  sortOrder?: 'asc' | 'desc';
};

/**
 * Reconciliation result
 */
declare type ReconciliationResult = {
  transactionId: string;
  previousState: TransactionState;
  newState: TransactionState;
  source: 'razorpay_sync' | 'bank_statement' | 'manual';
  reconciled: boolean;
  discrepancy?: string;
};

// ========================================
// Original Types (US Banking - Deprecated)
// ========================================

declare type SearchParamProps = {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

// ========================================

declare type SignUpParams = {
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  ssn: string;
  phone: string;
  email: string;
  password: string;
};

declare type LoginUser = {
  email: string;
  password: string;
};

declare type User = {
  $id: string;
  email: string;
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  ssn: string;
  phone: string;
  // Indian banking fields (Phase 2-3)
  panMasked?: string;
  aadhaarHash?: string;
  aadhaarLast4?: string;
  upiId?: string;
  kycStatus?: KYCStatus;
  setuConsentId?: string;
  razorpayCustomerId?: string;
};

declare type NewUserParams = {
  userId: string;
  email: string;
  name: string;
  password: string;
};

declare type Account = {
  id: string;
  availableBalance: number;
  currentBalance: number;
  officialName: string;
  mask: string;
  institutionId: string;
  name: string;
  type: string;
  subtype: string;
  appwriteItemId: string;
  shareableId: string;
};

declare type Transaction = {
  id: string;
  $id: string;
  name: string;
  paymentChannel: string;
  type: string;
  accountId: string;
  amount: number;
  pending: boolean;
  category: string;
  date: string;
  image: string;
  type: string;
  $createdAt: string;
  channel: string;
  senderBankId: string;
  receiverBankId: string;
};

declare type Bank = {
  $id: string;
  accountId: string;
  bankId: string;
  accessToken: string;
  fundingSourceUrl: string;
  userId: string;
  shareableId: string;
};

declare type AccountTypes =
  | "depository"
  | "credit"
  | "loan "
  | "investment"
  | "other";

declare type Category = "Food and Drink" | "Travel" | "Transfer";

declare type CategoryCount = {
  name: string;
  count: number;
  totalCount: number;
};

declare type Receiver = {
  firstName: string;
  lastName: string;
};

declare type TransferParams = {
  sourceFundingSourceUrl: string;
  destinationFundingSourceUrl: string;
  amount: string;
};

/**
 * @deprecated Use Indian banking types (RazorpayPayoutParams) instead
 * Kept for backward compatibility
 */
declare type AddFundingSourceParams = {
  customerId: string;
  processorToken: string;
  bankName: string;
};

/**
 * @deprecated Use UserIndia/SignUpParamsIndia instead
 * Kept for backward compatibility
 */
declare type NewDwollaCustomerParams = {
  firstName: string;
  lastName: string;
  email: string;
  type: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  dateOfBirth: string;
  ssn: string;
};

declare interface CreditCardProps {
  account: Account;
  userName: string;
  showBalance?: boolean;
}

declare interface BankInfoProps {
  account: Account;
  appwriteItemId?: string;
  type: "full" | "card";
}

declare interface HeaderBoxProps {
  type?: "title" | "greeting";
  title: string;
  subtext: string;
  user?: string;
}

declare interface MobileNavProps {
  user: User;
}

declare interface PageHeaderProps {
  topTitle: string;
  bottomTitle: string;
  topDescription: string;
  bottomDescription: string;
  connectBank?: boolean;
}

declare interface PaginationProps {
  page: number;
  totalPages: number;
}

/**
 * @deprecated PlaidLink component removed - Indian banking uses Setu AA
 * Kept for backward compatibility
 */
declare interface PlaidLinkProps {
  user: User;
  variant?: "primary" | "ghost";
}

// declare type User = sdk.Models.Document & {
//   accountId: string;
//   email: string;
//   name: string;
//   items: string[];
//   accessToken: string;
//   image: string;
// };

declare interface AuthFormProps {
  type: "sign-in" | "sign-up";
}

declare interface BankDropdownProps {
  accounts: Account[];
  setValue?: UseFormSetValue<any>;
  otherStyles?: string;
}

declare interface BankTabItemProps {
  account: Account;
  appwriteItemId?: string;
}

declare interface TotalBalanceBoxProps {
  accounts: Account[];
  totalBanks: number;
  totalCurrentBalance: number;
}

declare interface FooterProps {
  user: User;
  type?: 'mobile' | 'desktop'
}

declare interface RightSidebarProps {
  user: User;
  transactions: Transaction[];
  banks: Bank[] & Account[];
}

declare interface SiderbarProps {
  user: User;
}

declare interface RecentTransactionsProps {
  accounts: Account[];
  transactions: Transaction[];
  appwriteItemId: string;
  page: number;
}

declare interface TransactionHistoryTableProps {
  transactions: Transaction[];
  page: number;
}

declare interface CategoryBadgeProps {
  category: string;
}

declare interface TransactionTableProps {
  transactions: Transaction[];
}

declare interface CategoryProps {
  category: CategoryCount;
}

declare interface DoughnutChartProps {
  accounts: Account[];
}

declare interface PaymentTransferFormProps {
  accounts: Account[];
}

// Actions
declare interface getAccountsProps {
  userId: string;
}

declare interface getAccountProps {
  appwriteItemId: string;
}

declare interface getInstitutionProps {
  institutionId: string;
}

declare interface getTransactionsProps {
  accessToken: string;
}

/**
 * @deprecated Dwolla integration removed - Use Razorpay for Indian banking
 * Kept for backward compatibility
 */
declare interface CreateFundingSourceOptions {
  customerId: string;
  fundingSourceName: string;
  processorToken: string;
  _links: object;
}

declare interface CreateTransactionProps {
  name: string;
  amount: string;
  senderId: string;
  senderBankId: string;
  receiverId: string;
  receiverBankId: string;
  email: string;
}

declare interface getTransactionsByBankIdProps {
  bankId: string;
}

declare interface signInProps {
  email: string;
  password: string;
}

declare interface getUserInfoProps {
  userId: string;
}

declare interface exchangePublicTokenProps {
  publicToken: string;
  user: User;
}

declare interface createBankAccountProps {
  accessToken: string;
  userId: string;
  accountId: string;
  bankId: string;
  fundingSourceUrl: string;
  shareableId: string;
}

declare interface getBanksProps {
  userId: string;
}

declare interface getBankProps {
  documentId: string;
}

declare interface getBankByAccountIdProps {
  accountId: string;
}
