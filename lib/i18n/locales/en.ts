/**
 * English Translations
 * 
 * @module lib/i18n/locales/en
 */

export const enTranslations = {
  // ===========================================
  // Common
  // ===========================================
  app_name: 'Nivesh',
  welcome: 'Welcome',
  greeting: 'Hello, {name}!',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  cancel: 'Cancel',
  confirm: 'Confirm',
  save: 'Save',
  edit: 'Edit',
  delete: 'Delete',
  back: 'Back',
  next: 'Next',
  submit: 'Submit',
  continue: 'Continue',
  done: 'Done',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  close: 'Close',
  search: 'Search',
  filter: 'Filter',
  sort: 'Sort',
  refresh: 'Refresh',
  view_all: 'View All',
  see_more: 'See More',
  see_less: 'See Less',
  
  // ===========================================
  // Navigation
  // ===========================================
  nav_home: 'Home',
  nav_dashboard: 'Dashboard',
  nav_accounts: 'My Banks',
  nav_transactions: 'Transaction History',
  nav_transfer: 'Transfer Money',
  nav_payments: 'Payments',
  nav_settings: 'Settings',
  nav_profile: 'Profile',
  nav_logout: 'Logout',
  
  // ===========================================
  // Authentication
  // ===========================================
  auth_sign_in: 'Sign In',
  auth_sign_up: 'Sign Up',
  auth_sign_out: 'Sign Out',
  auth_forgot_password: 'Forgot Password?',
  auth_reset_password: 'Reset Password',
  auth_email: 'Email',
  auth_password: 'Password',
  auth_confirm_password: 'Confirm Password',
  auth_first_name: 'First Name',
  auth_last_name: 'Last Name',
  auth_phone: 'Phone Number',
  auth_dob: 'Date of Birth',
  auth_pan: 'PAN Number',
  auth_aadhaar: 'Aadhaar Number',
  auth_address: 'Address',
  auth_city: 'City',
  auth_state: 'State',
  auth_pincode: 'PIN Code',
  auth_no_account: "Don't have an account?",
  auth_have_account: 'Already have an account?',
  auth_terms_agree: 'I agree to the Terms of Service and Privacy Policy',
  
  // ===========================================
  // Dashboard
  // ===========================================
  dashboard_welcome: 'Welcome back, {name}!',
  dashboard_total_balance: 'Total Balance',
  dashboard_available_balance: 'Available Balance',
  dashboard_recent_transactions: 'Recent Transactions',
  dashboard_linked_accounts: 'Linked Accounts',
  dashboard_quick_actions: 'Quick Actions',
  dashboard_no_accounts: 'No bank accounts linked yet',
  dashboard_link_account: 'Link Bank Account',
  
  // ===========================================
  // Bank Accounts
  // ===========================================
  bank_accounts: 'Bank Accounts',
  bank_account_number: 'Account Number',
  bank_ifsc_code: 'IFSC Code',
  bank_account_type: 'Account Type',
  bank_savings: 'Savings Account',
  bank_current: 'Current Account',
  bank_branch: 'Branch',
  bank_holder_name: 'Account Holder Name',
  bank_link_new: 'Link New Account',
  bank_verify_account: 'Verify Account',
  bank_unlink: 'Unlink Account',
  bank_primary: 'Primary Account',
  bank_set_primary: 'Set as Primary',
  bank_linked_on: 'Linked on {date}',
  bank_last_synced: 'Last synced {time}',
  
  // ===========================================
  // Transactions
  // ===========================================
  txn_transactions: 'Transactions',
  txn_transaction_history: 'Transaction History',
  txn_no_transactions: 'No transactions yet',
  txn_transaction_id: 'Transaction ID',
  txn_reference_id: 'Reference ID',
  txn_amount: 'Amount',
  txn_date: 'Date',
  txn_time: 'Time',
  txn_type: 'Type',
  txn_status: 'Status',
  txn_description: 'Description',
  txn_sender: 'Sender',
  txn_receiver: 'Receiver',
  txn_credit: 'Credit',
  txn_debit: 'Debit',
  txn_pending: 'Pending',
  txn_processing: 'Processing',
  txn_completed: 'Completed',
  txn_failed: 'Failed',
  txn_cancelled: 'Cancelled',
  txn_reversed: 'Reversed',
  
  // ===========================================
  // Transfer
  // ===========================================
  transfer_title: 'Transfer Money',
  transfer_to_account: 'To Account',
  transfer_from_account: 'From Account',
  transfer_amount: 'Amount',
  transfer_remarks: 'Remarks (Optional)',
  transfer_purpose: 'Purpose',
  transfer_select_account: 'Select Account',
  transfer_add_beneficiary: 'Add Beneficiary',
  transfer_recent_beneficiaries: 'Recent Beneficiaries',
  transfer_confirm_details: 'Confirm Transfer Details',
  transfer_success: 'Transfer Successful!',
  transfer_failed: 'Transfer Failed',
  transfer_retry: 'Retry Transfer',
  
  // ===========================================
  // UPI
  // ===========================================
  upi_title: 'UPI Payment',
  upi_id: 'UPI ID',
  upi_scan_qr: 'Scan QR Code',
  upi_show_qr: 'Show QR Code',
  upi_enter_id: 'Enter UPI ID',
  upi_pay_to: 'Pay to {name}',
  upi_receive_from: 'Receive from {name}',
  upi_qr_expires: 'QR code expires in {time}',
  upi_invalid_id: 'Invalid UPI ID',
  upi_verified: 'UPI ID Verified',
  
  // ===========================================
  // OTP & Security
  // ===========================================
  otp_title: 'Enter OTP',
  otp_sent_to: 'OTP sent to {phone}',
  otp_enter_code: 'Enter the 6-digit code',
  otp_resend: 'Resend OTP',
  otp_resend_in: 'Resend in {seconds}s',
  otp_expired: 'OTP Expired',
  otp_invalid: 'Invalid OTP',
  otp_verified: 'OTP Verified',
  otp_verify: 'Verify OTP',
  security_2fa: 'Two-Factor Authentication',
  security_2fa_enable: 'Enable 2FA',
  security_2fa_disable: 'Disable 2FA',
  security_change_password: 'Change Password',
  security_session_timeout: 'Session Timeout',
  security_session_expired: 'Your session has expired. Please login again.',
  security_session_warning: 'Your session will expire in {minutes} minutes.',
  
  // ===========================================
  // KYC
  // ===========================================
  kyc_title: 'KYC Verification',
  kyc_pending: 'KYC Pending',
  kyc_verified: 'KYC Verified',
  kyc_rejected: 'KYC Rejected',
  kyc_complete_message: 'Please complete your KYC to access all features.',
  kyc_pan_verification: 'PAN Verification',
  kyc_aadhaar_verification: 'Aadhaar Verification',
  kyc_bank_verification: 'Bank Account Verification',
  
  // ===========================================
  // Settings
  // ===========================================
  settings_title: 'Settings',
  settings_language: 'Language',
  settings_notifications: 'Notifications',
  settings_security: 'Security',
  settings_privacy: 'Privacy',
  settings_help: 'Help & Support',
  settings_about: 'About',
  settings_version: 'Version',
  settings_terms: 'Terms of Service',
  settings_privacy_policy: 'Privacy Policy',
  
  // ===========================================
  // Errors
  // ===========================================
  error_generic: 'Something went wrong. Please try again.',
  error_network: 'Network error. Please check your connection.',
  error_timeout: 'Request timed out. Please try again.',
  error_unauthorized: 'Unauthorized. Please login again.',
  error_not_found: 'Not found.',
  error_invalid_input: 'Please check your input.',
  error_insufficient_balance: 'Insufficient balance.',
  error_daily_limit_exceeded: 'Daily limit exceeded.',
  error_account_blocked: 'Account is blocked. Please contact support.',
  
  // ===========================================
  // Success Messages
  // ===========================================
  success_saved: 'Changes saved successfully.',
  success_deleted: 'Deleted successfully.',
  success_sent: 'Sent successfully.',
  success_verified: 'Verified successfully.',
  success_updated: 'Updated successfully.',
  
  // ===========================================
  // Currency
  // ===========================================
  currency_rupees: 'Rupees',
  currency_paise: 'Paise',
  currency_lakhs: 'Lakhs',
  currency_crores: 'Crores',
  
  // ===========================================
  // Accessibility
  // ===========================================
  a11y_skip_to_content: 'Skip to main content',
  a11y_menu_open: 'Open menu',
  a11y_menu_close: 'Close menu',
  a11y_loading: 'Loading, please wait',
  a11y_amount: '{amount} rupees',
  a11y_date: 'Date: {date}',
  a11y_status: 'Status: {status}',
};

export type TranslationKeys = keyof typeof enTranslations;
