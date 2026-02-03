'use server';

/**
 * Indian Bank Account Actions
 * 
 * Server actions for managing Indian bank accounts linked via Setu AA.
 * Handles account storage, verification, and retrieval.
 * 
 * @module lib/actions/bank-india.actions
 */

import { ID, Query, Models } from 'node-appwrite';
import { createAdminClient } from '../appwrite';
import { parseStringify } from '../utils';
import { ifscSchema } from '../validators/indian';

// ===========================================
// Environment Variables
// ===========================================

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
} = process.env;

// Collection ID for Indian bank accounts
const BANK_ACCOUNT_COLLECTION_ID = process.env.APPWRITE_BANK_ACCOUNT_COLLECTION_ID || 'bank_accounts_india';

// ===========================================
// Types
// ===========================================

interface BankAccountDocument extends Models.Document {
  userId: string;
  accountNumber: string;       // Encrypted
  accountNumberMasked: string; // XXXX1234
  ifscCode: string;
  bankName: string;
  accountHolderName: string;
  accountType: 'savings' | 'current';
  upiId?: string;
  setuConsentId?: string;
  setuAccountLinkId?: string;
  razorpayFundAccountId?: string;
  razorpayContactId?: string;
  isVerified: boolean;
  isPrimary: boolean;
  balance?: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
}

interface CreateBankAccountParams {
  userId: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  accountHolderName: string;
  accountType: 'savings' | 'current';
  upiId?: string;
  setuConsentId?: string;
  setuAccountLinkId?: string;
  balance?: number;
}

interface UpdateBankAccountParams {
  accountId: string;
  upiId?: string;
  isPrimary?: boolean;
  razorpayFundAccountId?: string;
  razorpayContactId?: string;
  balance?: number;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Masks account number for display
 * Shows only last 4 digits: XXXX1234
 */
const maskAccountNumber = (accountNumber: string): string => {
  if (accountNumber.length <= 4) {
    return accountNumber;
  }
  const visibleDigits = accountNumber.slice(-4);
  const maskedPart = 'X'.repeat(accountNumber.length - 4);
  return `${maskedPart}${visibleDigits}`;
};

/**
 * Validates IFSC code format
 */
const validateIFSC = (ifsc: string): boolean => {
  const result = ifscSchema.safeParse(ifsc);
  return result.success;
};

// ===========================================
// Bank Account CRUD Operations
// ===========================================

/**
 * Creates a new bank account record
 * 
 * @param params - Bank account details
 * @returns Created bank account
 */
export const createBankAccountIndia = async (
  params: CreateBankAccountParams
): Promise<{ success: boolean; account?: IndianBankAccount; error?: string }> => {
  const {
    userId,
    accountNumber,
    ifscCode,
    bankName,
    accountHolderName,
    accountType,
    upiId,
    setuConsentId,
    setuAccountLinkId,
    balance,
  } = params;

  try {
    // Validate IFSC
    if (!validateIFSC(ifscCode)) {
      return {
        success: false,
        error: 'Invalid IFSC code format',
      };
    }

    const { database } = await createAdminClient();
    const now = Date.now();

    // Check if account already exists
    const existingAccounts = await database.listDocuments<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('accountNumberMasked', maskAccountNumber(accountNumber)),
        Query.equal('ifscCode', ifscCode.toUpperCase()),
      ]
    );

    if (existingAccounts.total > 0) {
      return {
        success: false,
        error: 'Bank account already linked',
      };
    }

    // Check if this is the first account (make it primary)
    const userAccounts = await database.listDocuments<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      [Query.equal('userId', userId)]
    );
    const isPrimary = userAccounts.total === 0;

    // Create bank account document
    // Note: In production, encrypt accountNumber before storing
    const newAccount = await database.createDocument<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      ID.unique(),
      {
        userId,
        accountNumber, // TODO: Encrypt in production
        accountNumberMasked: maskAccountNumber(accountNumber),
        ifscCode: ifscCode.toUpperCase(),
        bankName,
        accountHolderName,
        accountType,
        upiId: upiId || null,
        setuConsentId: setuConsentId || null,
        setuAccountLinkId: setuAccountLinkId || null,
        razorpayFundAccountId: null,
        razorpayContactId: null,
        isVerified: !!setuConsentId, // Auto-verify if linked via Setu
        isPrimary,
        balance: balance || null,
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
      }
    );

    return {
      success: true,
      account: parseStringify({
        $id: newAccount.$id,
        userId: newAccount.userId,
        accountNumber: maskAccountNumber(accountNumber), // Never return full number
        ifscCode: newAccount.ifscCode,
        bankName: newAccount.bankName,
        accountHolderName: newAccount.accountHolderName,
        accountType: newAccount.accountType,
        upiId: newAccount.upiId,
        setuConsentId: newAccount.setuConsentId,
        setuAccountLinkId: newAccount.setuAccountLinkId,
        razorpayFundAccountId: newAccount.razorpayFundAccountId,
        razorpayContactId: newAccount.razorpayContactId,
        isVerified: newAccount.isVerified,
        isPrimary: newAccount.isPrimary,
        createdAt: new Date(now).toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error creating bank account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bank account',
    };
  }
};

/**
 * Gets all bank accounts for a user
 * 
 * @param userId - User ID
 * @returns List of bank accounts
 */
export const getUserBankAccounts = async (
  userId: string
): Promise<{ success: boolean; accounts: IndianBankAccount[]; error?: string }> => {
  try {
    const { database } = await createAdminClient();

    const records = await database.listDocuments<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.orderDesc('isPrimary'),
        Query.orderDesc('createdAt'),
      ]
    );

    const accounts: IndianBankAccount[] = records.documents.map(doc => ({
      $id: doc.$id,
      userId: doc.userId,
      accountNumber: doc.accountNumberMasked, // Always return masked
      ifscCode: doc.ifscCode,
      bankName: doc.bankName,
      accountHolderName: doc.accountHolderName,
      accountType: doc.accountType,
      upiId: doc.upiId,
      setuConsentId: doc.setuConsentId,
      setuAccountLinkId: doc.setuAccountLinkId,
      razorpayFundAccountId: doc.razorpayFundAccountId,
      razorpayContactId: doc.razorpayContactId,
      isVerified: doc.isVerified,
      isPrimary: doc.isPrimary,
      createdAt: new Date(doc.createdAt).toISOString(),
    }));

    return { success: true, accounts };
  } catch (error) {
    console.error('Error getting bank accounts:', error);
    return {
      success: false,
      accounts: [],
      error: error instanceof Error ? error.message : 'Failed to get bank accounts',
    };
  }
};

/**
 * Gets a single bank account by ID
 * 
 * @param accountId - Bank account document ID
 * @returns Bank account details
 */
export const getBankAccount = async (
  accountId: string
): Promise<{ success: boolean; account?: IndianBankAccount; error?: string }> => {
  try {
    const { database } = await createAdminClient();

    const doc = await database.getDocument<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      accountId
    );

    return {
      success: true,
      account: parseStringify({
        $id: doc.$id,
        userId: doc.userId,
        accountNumber: doc.accountNumberMasked,
        ifscCode: doc.ifscCode,
        bankName: doc.bankName,
        accountHolderName: doc.accountHolderName,
        accountType: doc.accountType,
        upiId: doc.upiId,
        setuConsentId: doc.setuConsentId,
        setuAccountLinkId: doc.setuAccountLinkId,
        razorpayFundAccountId: doc.razorpayFundAccountId,
        razorpayContactId: doc.razorpayContactId,
        isVerified: doc.isVerified,
        isPrimary: doc.isPrimary,
        createdAt: new Date(doc.createdAt).toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error getting bank account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bank account',
    };
  }
};

/**
 * Updates a bank account
 * 
 * @param params - Update parameters
 * @returns Updated bank account
 */
export const updateBankAccount = async (
  params: UpdateBankAccountParams
): Promise<{ success: boolean; account?: IndianBankAccount; error?: string }> => {
  const { accountId, upiId, isPrimary, razorpayFundAccountId, razorpayContactId, balance } = params;

  try {
    const { database } = await createAdminClient();

    // Build update data
    const updateData: Record<string, string | boolean | number | null> = {
      updatedAt: Date.now(),
    };

    if (upiId !== undefined) {
      updateData.upiId = upiId || null;
    }

    if (isPrimary !== undefined) {
      updateData.isPrimary = isPrimary;
    }

    if (razorpayFundAccountId !== undefined) {
      updateData.razorpayFundAccountId = razorpayFundAccountId || null;
    }

    if (razorpayContactId !== undefined) {
      updateData.razorpayContactId = razorpayContactId || null;
    }

    if (balance !== undefined) {
      updateData.balance = balance;
    }

    // If setting as primary, unset other primary accounts
    if (isPrimary) {
      const currentAccount = await database.getDocument<BankAccountDocument>(
        DATABASE_ID!,
        BANK_ACCOUNT_COLLECTION_ID,
        accountId
      );

      const otherPrimaryAccounts = await database.listDocuments<BankAccountDocument>(
        DATABASE_ID!,
        BANK_ACCOUNT_COLLECTION_ID,
        [
          Query.equal('userId', currentAccount.userId),
          Query.equal('isPrimary', true),
          Query.notEqual('$id', accountId),
        ]
      );

      // Unset primary on other accounts
      for (const account of otherPrimaryAccounts.documents) {
        await database.updateDocument(
          DATABASE_ID!,
          BANK_ACCOUNT_COLLECTION_ID,
          account.$id,
          { isPrimary: false, updatedAt: Date.now() }
        );
      }
    }

    // Update the account
    const updatedDoc = await database.updateDocument<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      accountId,
      updateData
    );

    return {
      success: true,
      account: parseStringify({
        $id: updatedDoc.$id,
        userId: updatedDoc.userId,
        accountNumber: updatedDoc.accountNumberMasked,
        ifscCode: updatedDoc.ifscCode,
        bankName: updatedDoc.bankName,
        accountHolderName: updatedDoc.accountHolderName,
        accountType: updatedDoc.accountType,
        upiId: updatedDoc.upiId,
        setuConsentId: updatedDoc.setuConsentId,
        setuAccountLinkId: updatedDoc.setuAccountLinkId,
        razorpayFundAccountId: updatedDoc.razorpayFundAccountId,
        razorpayContactId: updatedDoc.razorpayContactId,
        isVerified: updatedDoc.isVerified,
        isPrimary: updatedDoc.isPrimary,
        createdAt: new Date(updatedDoc.createdAt).toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error updating bank account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update bank account',
    };
  }
};

/**
 * Deletes a bank account
 * 
 * @param accountId - Bank account document ID
 * @returns Success status
 */
export const deleteBankAccount = async (
  accountId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { database } = await createAdminClient();

    // Get account to check if it's primary
    const account = await database.getDocument<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      accountId
    );

    // Delete the account
    await database.deleteDocument(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      accountId
    );

    // If deleted account was primary, set another as primary
    if (account.isPrimary) {
      const remainingAccounts = await database.listDocuments<BankAccountDocument>(
        DATABASE_ID!,
        BANK_ACCOUNT_COLLECTION_ID,
        [
          Query.equal('userId', account.userId),
          Query.orderDesc('createdAt'),
          Query.limit(1),
        ]
      );

      if (remainingAccounts.total > 0) {
        await database.updateDocument(
          DATABASE_ID!,
          BANK_ACCOUNT_COLLECTION_ID,
          remainingAccounts.documents[0].$id,
          { isPrimary: true, updatedAt: Date.now() }
        );
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting bank account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete bank account',
    };
  }
};

// ===========================================
// Account Discovery & Linking
// ===========================================

/**
 * Links bank accounts discovered via Setu AA
 * 
 * @param userId - User ID
 * @param consentId - Setu consent ID
 * @param accounts - Discovered accounts from Setu
 * @returns Linked accounts
 */
export const linkSetuAccounts = async (
  userId: string,
  consentId: string,
  accounts: SetuDiscoveredAccount[]
): Promise<{ success: boolean; linkedAccounts: IndianBankAccount[]; errors: string[] }> => {
  const linkedAccounts: IndianBankAccount[] = [];
  const errors: string[] = [];

  for (const account of accounts) {
    const result = await createBankAccountIndia({
      userId,
      accountNumber: account.accountNumber,
      ifscCode: account.ifsc,
      bankName: account.bankName,
      accountHolderName: account.holderName || 'Account Holder',
      accountType: account.accountType === 'savings' || account.accountType === 'current'
        ? account.accountType
        : 'savings',
      setuConsentId: consentId,
      setuAccountLinkId: account.accountNumber,
      balance: account.balance,
    });

    if (result.success && result.account) {
      linkedAccounts.push(result.account);
    } else {
      errors.push(`Failed to link ${account.maskedNumber}: ${result.error}`);
    }
  }

  return {
    success: linkedAccounts.length > 0,
    linkedAccounts,
    errors,
  };
};

/**
 * Gets the primary bank account for a user
 * 
 * @param userId - User ID
 * @returns Primary bank account or null
 */
export const getPrimaryBankAccount = async (
  userId: string
): Promise<IndianBankAccount | null> => {
  try {
    const { database } = await createAdminClient();

    const records = await database.listDocuments<BankAccountDocument>(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      [
        Query.equal('userId', userId),
        Query.equal('isPrimary', true),
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
      accountNumber: doc.accountNumberMasked,
      ifscCode: doc.ifscCode,
      bankName: doc.bankName,
      accountHolderName: doc.accountHolderName,
      accountType: doc.accountType,
      upiId: doc.upiId,
      setuConsentId: doc.setuConsentId,
      setuAccountLinkId: doc.setuAccountLinkId,
      razorpayFundAccountId: doc.razorpayFundAccountId,
      razorpayContactId: doc.razorpayContactId,
      isVerified: doc.isVerified,
      isPrimary: doc.isPrimary,
      createdAt: new Date(doc.createdAt).toISOString(),
    });
  } catch (error) {
    console.error('Error getting primary bank account:', error);
    return null;
  }
};

/**
 * Verifies a bank account (manual verification)
 * 
 * @param accountId - Bank account document ID
 * @returns Updated account
 */
export const verifyBankAccount = async (
  accountId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { database } = await createAdminClient();

    await database.updateDocument(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID,
      accountId,
      {
        isVerified: true,
        updatedAt: Date.now(),
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Error verifying bank account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify bank account',
    };
  }
};
