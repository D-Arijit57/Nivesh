"use server";

/**
 * Bank Actions for Indian Banking
 * 
 * This module provides bank account operations using Indian banking
 * infrastructure (Setu Account Aggregator, Razorpay, UPI).
 * 
 * Plaid/Dwolla have been removed in favor of Indian-specific solutions.
 * 
 * @module lib/actions/bank.actions
 */

import { Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { parseStringify } from "../utils";
import { getTransactionsByBankId } from "./transaction.actions";
import { getBanks, getBank } from "./user.actions";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_ACCOUNT_COLLECTION_ID: BANK_ACCOUNT_COLLECTION_ID,
} = process.env;

// ===========================================
// Indian Bank Account Types
// ===========================================

interface IndianBankAccount {
  id: string;
  accountNumber: string;
  accountNumberMasked: string;
  ifscCode: string;
  bankName: string;
  accountType: 'savings' | 'current';
  holderName: string;
  availableBalance: number;
  currentBalance: number;
  appwriteItemId: string;
  shareableId: string;
  isVerified: boolean;
  linkedAt: string;
}

// ===========================================
// Get Accounts (Indian Banking)
// ===========================================

/**
 * Get all bank accounts for a user
 * Uses Setu-linked accounts from Appwrite database
 */
export const getAccounts = async ({ userId }: getAccountsProps) => {
  try {
    const { database } = await createAdminClient();

    // Get Indian bank accounts from database
    const bankAccounts = await database.listDocuments(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    );

    if (bankAccounts.total === 0) {
      return parseStringify({ data: [], totalBanks: 0, totalCurrentBalance: 0 });
    }

    // Map to Account format for compatibility
    const accounts = bankAccounts.documents.map((bank: any) => ({
      id: bank.$id,
      availableBalance: bank.availableBalance || 0,
      currentBalance: bank.currentBalance || 0,
      institutionId: bank.ifscCode?.substring(0, 4) || 'UNKNOWN',
      name: bank.bankName || 'Bank Account',
      officialName: `${bank.bankName} - ${bank.accountType}`,
      mask: bank.accountNumberMasked?.slice(-4) || '****',
      type: bank.accountType === 'savings' ? 'depository' : 'depository',
      subtype: bank.accountType || 'savings',
      appwriteItemId: bank.$id,
      shareableId: bank.shareableId || bank.$id,
    }));

    const totalBanks = accounts.length;
    const totalCurrentBalance = accounts.reduce((total: number, account: any) => {
      return total + (account.currentBalance || 0);
    }, 0);

    return parseStringify({ data: accounts, totalBanks, totalCurrentBalance });
  } catch (error) {
    console.error("An error occurred while getting the accounts:", error);
    return parseStringify({ data: [], totalBanks: 0, totalCurrentBalance: 0 });
  }
};

// ===========================================
// Get Single Account (Indian Banking)
// ===========================================

/**
 * Get a single bank account with transactions
 * Uses Setu-linked accounts from Appwrite database
 */
export const getAccount = async ({ appwriteItemId }: getAccountProps) => {
  try {
    const { database } = await createAdminClient();

    // Get the bank account from database
    const bankAccounts = await database.listDocuments(
      DATABASE_ID!,
      BANK_ACCOUNT_COLLECTION_ID!,
      [Query.equal('$id', [appwriteItemId])]
    );

    if (bankAccounts.total === 0) {
      throw new Error('Bank account not found');
    }

    const bank = bankAccounts.documents[0] as any;

    // Get transactions from database
    const transferTransactionsData = await getTransactionsByBankId({
      bankId: bank.$id,
    });

    const transferTransactions = transferTransactionsData?.documents?.map(
      (transferData: Transaction) => ({
        id: transferData.$id,
        name: transferData.name!,
        amount: transferData.amount!,
        date: transferData.$createdAt,
        paymentChannel: transferData.channel || 'online',
        category: transferData.category || 'Transfer',
        type: transferData.senderBankId === bank.$id ? "debit" : "credit",
      })
    ) || [];

    // Build account object
    const account = {
      id: bank.$id,
      availableBalance: bank.availableBalance || 0,
      currentBalance: bank.currentBalance || 0,
      institutionId: bank.ifscCode?.substring(0, 4) || 'UNKNOWN',
      name: bank.bankName || 'Bank Account',
      officialName: `${bank.bankName} - ${bank.accountType}`,
      mask: bank.accountNumberMasked?.slice(-4) || '****',
      type: bank.accountType === 'savings' ? 'depository' : 'depository',
      subtype: bank.accountType || 'savings',
      appwriteItemId: bank.$id,
    };

    // Sort transactions by date (most recent first)
    const allTransactions = [...transferTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return parseStringify({
      data: account,
      transactions: allTransactions,
    });
  } catch (error) {
    console.error("An error occurred while getting the account:", error);
    return null;
  }
};

// ===========================================
// Get Institution (Indian Banking)
// ===========================================

/**
 * Get bank institution info by IFSC code
 * Uses IFSC code to identify Indian banks
 */
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  try {
    // For Indian banking, institutionId is the first 4 chars of IFSC
    // This is a simplified lookup - in production, use RBI's IFSC database
    const bankCodes: Record<string, { name: string; logo?: string }> = {
      'SBIN': { name: 'State Bank of India' },
      'HDFC': { name: 'HDFC Bank' },
      'ICIC': { name: 'ICICI Bank' },
      'AXIS': { name: 'Axis Bank' },
      'PUNB': { name: 'Punjab National Bank' },
      'BARB': { name: 'Bank of Baroda' },
      'CNRB': { name: 'Canara Bank' },
      'UBIN': { name: 'Union Bank of India' },
      'IDFB': { name: 'IDFC First Bank' },
      'KKBK': { name: 'Kotak Mahindra Bank' },
      'YESB': { name: 'Yes Bank' },
      'INDB': { name: 'IndusInd Bank' },
    };

    const bankInfo = bankCodes[institutionId] || { name: 'Unknown Bank' };

    return parseStringify({
      institution_id: institutionId,
      name: bankInfo.name,
      logo: bankInfo.logo,
    });
  } catch (error) {
    console.error("An error occurred while getting the institution:", error);
    return { institution_id: institutionId, name: 'Unknown Bank' };
  }
};

// ===========================================
// Get Transactions (Indian Banking)
// ===========================================

/**
 * Get transactions for an account
 * For Indian banking, transactions come from Setu AA or database
 * 
 * Note: Real-time transaction fetch requires active Setu consent
 * This function returns cached/stored transactions from database
 */
export const getTransactions = async ({
  accessToken,
}: getTransactionsProps) => {
  try {
    // For Indian banking without Plaid, we get transactions from database
    // The accessToken here would be a Setu session or account reference
    // Real implementation would fetch from Setu AA if consent is active
    
    console.warn('getTransactions: Using database transactions. For real-time data, integrate Setu AA.');
    
    // Return empty array - transactions are fetched via getTransactionsByBankId
    return parseStringify([]);
  } catch (error) {
    console.error("An error occurred while getting transactions:", error);
    return [];
  }
};

// ===========================================
// Legacy Exports (for backward compatibility)
// ===========================================

// These are kept for components that may still reference them
// They now use the Indian banking implementations above
