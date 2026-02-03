'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import { encryptId, parseStringify } from "../utils";
import { revalidatePath } from "next/cache";

// Indian KYC imports
import { encrypt, hashAadhaar, maskAadhaar } from "../encryption";
import { indianSignUpSchema } from "../validators/indian";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();

    const user = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    const user = await getUserInfo({ userId: session.userId }) 

    return parseStringify(user);
  } catch (error) {
    console.error('Error', error);
  }
}

/**
 * Sign up - Redirects to Indian sign-up flow
 * @deprecated Use signUpIndia instead for Indian banking
 */
export const signUp = async ({ password, ...userData }: SignUpParams) => {
  // For Indian banking, we use the Indian sign-up flow
  // This maintains backward compatibility while transitioning
  const { email, firstName, lastName } = userData;
  
  let newUserAccount;

  try {
    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(), 
      email, 
      password, 
      `${firstName} ${lastName}`
    );

    if(!newUserAccount) throw new Error('Error creating user')

    // Create user document without Dwolla (Indian flow)
    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        ...userData,
        userId: newUserAccount.$id,
        // Indian banking fields (Phase 2-3 will add Setu/Razorpay)
        kycVerified: false,
        kycStatus: 'pending',
      }
    )

    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify(newUser);
  } catch (error) {
    console.error('Error', error);
  }
}

export async function getLoggedInUser() {
  try {
    const { account } = await createSessionClient();
    const result = await account.get();

    const user = await getUserInfo({ userId: result.$id})

    return parseStringify(user);
  } catch (error) {
    console.log(error)
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();

    cookies().delete('appwrite-session');

    await account.deleteSession('current');
  } catch (error) {
    return null;
  }
}

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    const bankAccount = await database.createDocument(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      ID.unique(),
      {
        userId,
        bankId,
        accountId,
        accessToken,
        fundingSourceUrl,
        shareableId,
      }
    )

    return parseStringify(bankAccount);
  } catch (error) {
    console.log(error);
  }
}

/**
 * @deprecated Plaid/Dwolla removed - Use Indian banking (Setu) for account linking
 * This function is kept for backward compatibility but will throw an error
 */
export const createLinkToken = async (user: User) => {
  console.warn('createLinkToken is deprecated. Use Setu Account Aggregator for Indian banking.');
  throw new Error('Plaid integration removed. Use Setu Account Aggregator for linking bank accounts.');
}

/**
 * @deprecated Plaid/Dwolla removed - Use Indian banking (Setu) for account linking
 * This function is kept for backward compatibility but will throw an error
 */
export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  console.warn('exchangePublicToken is deprecated. Use Setu Account Aggregator for Indian banking.');
  throw new Error('Plaid integration removed. Use Setu Account Aggregator for linking bank accounts.');
}

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    const banks = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    )

    return parseStringify(banks.documents);
  } catch (error) {
    console.log(error)
  }
}

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('$id', [documentId])]
    )

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    const { database } = await createAdminClient();

    const bank = await database.listDocuments(
      DATABASE_ID!,
      BANK_COLLECTION_ID!,
      [Query.equal('accountId', [accountId])]
    )

    if(bank.total !== 1) return null;

    return parseStringify(bank.documents[0]);
  } catch (error) {
    console.log(error)
  }
}

// ===========================================
// Indian Banking Functions
// ===========================================

/**
 * Sign up a new user with Indian KYC (PAN/Aadhaar/UPI)
 * 
 * This function:
 * 1. Validates Indian KYC data (PAN, Aadhaar, or UPI required)
 * 2. Encrypts sensitive data (PAN, creates Aadhaar hash)
 * 3. Creates Appwrite account and user document
 * 4. Does NOT create Dwolla/Plaid connections (Phase 2 will add Setu/Razorpay)
 * 
 * @param userData - Indian sign-up parameters with KYC
 * @returns Created user or error
 */
export const signUpIndia = async ({ password, ...userData }: SignUpParamsIndia) => {
  const { email, firstName, lastName, pan, aadhaar, upiId } = userData;
  
  let newUserAccount;

  try {
    // Validate Indian KYC data
    const validation = indianSignUpSchema.safeParse({ ...userData, password });
    if (!validation.success) {
      console.error('Validation error:', validation.error.format());
      throw new Error(`Validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`);
    }

    const { account, database } = await createAdminClient();

    // Create Appwrite account
    newUserAccount = await account.create(
      ID.unique(), 
      email, 
      password, 
      `${firstName} ${lastName}`
    );

    if (!newUserAccount) throw new Error('Error creating user account');

    // Prepare KYC data for storage
    const kycData: Record<string, string | boolean | null> = {
      kycVerified: false,
      kycStatus: 'pending' as KYCStatus,
      kycVerifiedAt: null,
      kycRejectedReason: null,
    };

    // Encrypt PAN if provided
    if (pan) {
      const encryptedPan = encrypt(pan);
      kycData.pan = encryptedPan;
      // Masked format: ABCDE****F (5 chars + 4 asterisks + 1 char = 10 chars)
      kycData.panMasked = `${pan.slice(0, 5)}****${pan.slice(-1)}`;
    }

    // Hash Aadhaar if provided (never store raw Aadhaar)
    if (aadhaar) {
      // Remove spaces from formatted Aadhaar
      const rawAadhaar = aadhaar.replace(/\s/g, '');
      kycData.aadhaarHash = hashAadhaar(rawAadhaar);
      kycData.aadhaarLast4 = maskAadhaar(rawAadhaar); // Returns XXXX-XXXX-1234
    }

    // Store UPI ID if provided
    if (upiId) {
      kycData.upiId = upiId.toLowerCase();
    }

    // Clean phone number for storage (+91XXXXXXXXXX format)
    const cleanPhone = userData.phone.replace(/\s/g, '');

    // Create user document in Appwrite
    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        userId: newUserAccount.$id,
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        address1: userData.address1,
        city: userData.city,
        state: userData.state,
        postalCode: userData.postalCode,
        dateOfBirth: userData.dateOfBirth,
        phone: cleanPhone,
        // Indian KYC fields
        ...kycData,
        // Placeholder for Indian payment providers (Phase 2-3)
        setuConsentId: null,
        razorpayCustomerId: null,
        razorpayFundAccountId: null,
      }
    );

    // Create session
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify(newUser);
  } catch (error) {
    console.error('Error in signUpIndia:', error);
    
    // Clean up: delete account if user document creation failed
    if (newUserAccount) {
      try {
        const { account } = await createAdminClient();
        // Note: Admin SDK doesn't have deleteUser, would need to handle this differently
        console.error('User account created but document failed. Manual cleanup needed for:', newUserAccount.$id);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    
    throw error;
  }
};

/**
 * Update user KYC information
 * 
 * @param userId - User ID to update
 * @param kycData - KYC fields to update
 * @returns Updated user
 */
export const updateUserKYC = async (
  userId: string,
  kycData: {
    pan?: string;
    aadhaar?: string;
    upiId?: string;
  }
) => {
  try {
    const { database } = await createAdminClient();

    // Find user document
    const users = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    );

    if (users.total === 0) {
      throw new Error('User not found');
    }

    const userDoc = users.documents[0];
    const updateData: Record<string, string | boolean> = {};

    // Encrypt PAN if provided
    if (kycData.pan) {
      const encryptedPan = encrypt(kycData.pan);
      updateData.pan = encryptedPan;
      updateData.panMasked = `${kycData.pan.slice(0, 5)}****${kycData.pan.slice(-1)}`;
    }

    // Hash Aadhaar if provided
    if (kycData.aadhaar) {
      const rawAadhaar = kycData.aadhaar.replace(/\s/g, '');
      updateData.aadhaarHash = hashAadhaar(rawAadhaar);
      updateData.aadhaarLast4 = maskAadhaar(rawAadhaar);
    }

    // Store UPI ID if provided
    if (kycData.upiId) {
      updateData.upiId = kycData.upiId.toLowerCase();
    }

    // Update user document
    const updatedUser = await database.updateDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      userDoc.$id,
      updateData
    );

    return parseStringify(updatedUser);
  } catch (error) {
    console.error('Error updating KYC:', error);
    throw error;
  }
};

/**
 * Update user KYC status
 * Called after verification via Setu AA or manual verification
 * 
 * @param userId - User ID to update
 * @param status - New KYC status
 * @param reason - Optional rejection reason (required if status is 'rejected')
 * @returns Updated user
 */
export const updateUserKYCStatus = async (
  userId: string,
  status: KYCStatus,
  reason?: string
) => {
  try {
    const { database } = await createAdminClient();

    // Find user document
    const users = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', [userId])]
    );

    if (users.total === 0) {
      throw new Error('User not found');
    }

    const userDoc = users.documents[0];

    // Build update data
    const updateData: Record<string, string | boolean | null> = {
      kycStatus: status,
      kycVerified: status === 'verified', // Keep backwards compatibility
    };

    if (status === 'verified') {
      updateData.kycVerifiedAt = new Date().toISOString();
      updateData.kycRejectedReason = null;
    } else if (status === 'rejected') {
      updateData.kycRejectedReason = reason || 'Verification failed';
      updateData.kycVerifiedAt = null;
    } else if (status === 'expired') {
      updateData.kycVerifiedAt = null;
    }

    // Update KYC status
    const updatedUser = await database.updateDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      userDoc.$id,
      updateData
    );

    return parseStringify(updatedUser);
  } catch (error) {
    console.error('Error updating KYC status:', error);
    throw error;
  }
};

/**
 * Mark user KYC as verified (convenience function)
 * @deprecated Use updateUserKYCStatus instead
 * Called after successful verification via Setu AA or manual verification
 * 
 * @param userId - User ID to verify
 * @returns Updated user
 */
export const verifyUserKYC = async (userId: string) => {
  return updateUserKYCStatus(userId, 'verified');
};

/**
 * Get user by phone number
 * Used for OTP login flow
 * 
 * @param phone - Phone number in +91XXXXXXXXXX format
 * @returns User or null
 */
export const getUserByPhone = async (phone: string): Promise<UserIndia | null> => {
  try {
    const { database } = await createAdminClient();

    // Clean phone number
    const cleanPhone = phone.replace(/\s/g, '');

    const users = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('phone', [cleanPhone])]
    );

    if (users.total === 0) {
      return null;
    }

    return parseStringify(users.documents[0]);
  } catch (error) {
    console.error('Error getting user by phone:', error);
    return null;
  }
};