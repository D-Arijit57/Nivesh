/**
 * Hindi Translations
 * 
 * @module lib/i18n/locales/hi
 */

import { enTranslations } from './en';

// Ensure hi has same type as en
export const hiTranslations: typeof enTranslations = {
  // ===========================================
  // Common
  // ===========================================
  app_name: 'निवेश',
  welcome: 'स्वागत है',
  greeting: 'नमस्ते, {name}!',
  loading: 'लोड हो रहा है...',
  error: 'त्रुटि',
  success: 'सफल',
  cancel: 'रद्द करें',
  confirm: 'पुष्टि करें',
  save: 'सहेजें',
  edit: 'संपादित करें',
  delete: 'हटाएं',
  back: 'वापस',
  next: 'आगे',
  submit: 'जमा करें',
  continue: 'जारी रखें',
  done: 'हो गया',
  yes: 'हां',
  no: 'नहीं',
  ok: 'ठीक है',
  close: 'बंद करें',
  search: 'खोजें',
  filter: 'फ़िल्टर',
  sort: 'क्रमबद्ध करें',
  refresh: 'रीफ़्रेश',
  view_all: 'सभी देखें',
  see_more: 'और देखें',
  see_less: 'कम देखें',
  
  // ===========================================
  // Navigation
  // ===========================================
  nav_home: 'होम',
  nav_dashboard: 'डैशबोर्ड',
  nav_accounts: 'मेरे बैंक',
  nav_transactions: 'लेनदेन इतिहास',
  nav_transfer: 'पैसे भेजें',
  nav_payments: 'भुगतान',
  nav_settings: 'सेटिंग्स',
  nav_profile: 'प्रोफ़ाइल',
  nav_logout: 'लॉग आउट',
  
  // ===========================================
  // Authentication
  // ===========================================
  auth_sign_in: 'साइन इन करें',
  auth_sign_up: 'साइन अप करें',
  auth_sign_out: 'साइन आउट करें',
  auth_forgot_password: 'पासवर्ड भूल गए?',
  auth_reset_password: 'पासवर्ड रीसेट करें',
  auth_email: 'ईमेल',
  auth_password: 'पासवर्ड',
  auth_confirm_password: 'पासवर्ड की पुष्टि करें',
  auth_first_name: 'पहला नाम',
  auth_last_name: 'अंतिम नाम',
  auth_phone: 'फ़ोन नंबर',
  auth_dob: 'जन्म तिथि',
  auth_pan: 'पैन नंबर',
  auth_aadhaar: 'आधार नंबर',
  auth_address: 'पता',
  auth_city: 'शहर',
  auth_state: 'राज्य',
  auth_pincode: 'पिन कोड',
  auth_no_account: 'खाता नहीं है?',
  auth_have_account: 'पहले से खाता है?',
  auth_terms_agree: 'मैं सेवा की शर्तों और गोपनीयता नीति से सहमत हूं',
  
  // ===========================================
  // Dashboard
  // ===========================================
  dashboard_welcome: 'वापसी पर स्वागत है, {name}!',
  dashboard_total_balance: 'कुल शेष राशि',
  dashboard_available_balance: 'उपलब्ध शेष',
  dashboard_recent_transactions: 'हाल के लेनदेन',
  dashboard_linked_accounts: 'लिंक किए गए खाते',
  dashboard_quick_actions: 'त्वरित कार्य',
  dashboard_no_accounts: 'अभी तक कोई बैंक खाता लिंक नहीं है',
  dashboard_link_account: 'बैंक खाता लिंक करें',
  
  // ===========================================
  // Bank Accounts
  // ===========================================
  bank_accounts: 'बैंक खाते',
  bank_account_number: 'खाता संख्या',
  bank_ifsc_code: 'IFSC कोड',
  bank_account_type: 'खाता प्रकार',
  bank_savings: 'बचत खाता',
  bank_current: 'चालू खाता',
  bank_branch: 'शाखा',
  bank_holder_name: 'खाताधारक का नाम',
  bank_link_new: 'नया खाता लिंक करें',
  bank_verify_account: 'खाता सत्यापित करें',
  bank_unlink: 'खाता अनलिंक करें',
  bank_primary: 'प्राथमिक खाता',
  bank_set_primary: 'प्राथमिक के रूप में सेट करें',
  bank_linked_on: '{date} को लिंक किया गया',
  bank_last_synced: 'अंतिम सिंक {time}',
  
  // ===========================================
  // Transactions
  // ===========================================
  txn_transactions: 'लेनदेन',
  txn_transaction_history: 'लेनदेन इतिहास',
  txn_no_transactions: 'अभी तक कोई लेनदेन नहीं',
  txn_transaction_id: 'लेनदेन आईडी',
  txn_reference_id: 'संदर्भ आईडी',
  txn_amount: 'राशि',
  txn_date: 'तिथि',
  txn_time: 'समय',
  txn_type: 'प्रकार',
  txn_status: 'स्थिति',
  txn_description: 'विवरण',
  txn_sender: 'भेजने वाला',
  txn_receiver: 'प्राप्तकर्ता',
  txn_credit: 'जमा',
  txn_debit: 'निकासी',
  txn_pending: 'लंबित',
  txn_processing: 'प्रोसेसिंग',
  txn_completed: 'पूर्ण',
  txn_failed: 'विफल',
  txn_cancelled: 'रद्द',
  txn_reversed: 'वापस',
  
  // ===========================================
  // Transfer
  // ===========================================
  transfer_title: 'पैसे भेजें',
  transfer_to_account: 'प्राप्तकर्ता खाता',
  transfer_from_account: 'भेजने वाला खाता',
  transfer_amount: 'राशि',
  transfer_remarks: 'टिप्पणी (वैकल्पिक)',
  transfer_purpose: 'उद्देश्य',
  transfer_select_account: 'खाता चुनें',
  transfer_add_beneficiary: 'लाभार्थी जोड़ें',
  transfer_recent_beneficiaries: 'हाल के लाभार्थी',
  transfer_confirm_details: 'स्थानांतरण विवरण की पुष्टि करें',
  transfer_success: 'स्थानांतरण सफल!',
  transfer_failed: 'स्थानांतरण विफल',
  transfer_retry: 'पुनः प्रयास करें',
  
  // ===========================================
  // UPI
  // ===========================================
  upi_title: 'UPI भुगतान',
  upi_id: 'UPI आईडी',
  upi_scan_qr: 'QR कोड स्कैन करें',
  upi_show_qr: 'QR कोड दिखाएं',
  upi_enter_id: 'UPI आईडी दर्ज करें',
  upi_pay_to: '{name} को भुगतान करें',
  upi_receive_from: '{name} से प्राप्त करें',
  upi_qr_expires: 'QR कोड {time} में समाप्त होगा',
  upi_invalid_id: 'अमान्य UPI आईडी',
  upi_verified: 'UPI आईडी सत्यापित',
  
  // ===========================================
  // OTP & Security
  // ===========================================
  otp_title: 'OTP दर्ज करें',
  otp_sent_to: 'OTP {phone} पर भेजा गया',
  otp_enter_code: '6 अंकों का कोड दर्ज करें',
  otp_resend: 'OTP पुनः भेजें',
  otp_resend_in: '{seconds} सेकंड में पुनः भेजें',
  otp_expired: 'OTP समाप्त हो गया',
  otp_invalid: 'अमान्य OTP',
  otp_verified: 'OTP सत्यापित',
  otp_verify: 'OTP सत्यापित करें',
  security_2fa: 'टू-फैक्टर प्रमाणीकरण',
  security_2fa_enable: '2FA सक्षम करें',
  security_2fa_disable: '2FA अक्षम करें',
  security_change_password: 'पासवर्ड बदलें',
  security_session_timeout: 'सत्र समय सीमा',
  security_session_expired: 'आपका सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।',
  security_session_warning: 'आपका सत्र {minutes} मिनट में समाप्त हो जाएगा।',
  
  // ===========================================
  // KYC
  // ===========================================
  kyc_title: 'KYC सत्यापन',
  kyc_pending: 'KYC लंबित',
  kyc_verified: 'KYC सत्यापित',
  kyc_rejected: 'KYC अस्वीकृत',
  kyc_complete_message: 'सभी सुविधाओं का उपयोग करने के लिए कृपया अपना KYC पूरा करें।',
  kyc_pan_verification: 'पैन सत्यापन',
  kyc_aadhaar_verification: 'आधार सत्यापन',
  kyc_bank_verification: 'बैंक खाता सत्यापन',
  
  // ===========================================
  // Settings
  // ===========================================
  settings_title: 'सेटिंग्स',
  settings_language: 'भाषा',
  settings_notifications: 'सूचनाएं',
  settings_security: 'सुरक्षा',
  settings_privacy: 'गोपनीयता',
  settings_help: 'सहायता और समर्थन',
  settings_about: 'के बारे में',
  settings_version: 'संस्करण',
  settings_terms: 'सेवा की शर्तें',
  settings_privacy_policy: 'गोपनीयता नीति',
  
  // ===========================================
  // Errors
  // ===========================================
  error_generic: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
  error_network: 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें।',
  error_timeout: 'अनुरोध का समय समाप्त। कृपया पुनः प्रयास करें।',
  error_unauthorized: 'अनधिकृत। कृपया पुनः लॉगिन करें।',
  error_not_found: 'नहीं मिला।',
  error_invalid_input: 'कृपया अपना इनपुट जांचें।',
  error_insufficient_balance: 'अपर्याप्त शेष राशि।',
  error_daily_limit_exceeded: 'दैनिक सीमा पार हो गई।',
  error_account_blocked: 'खाता अवरुद्ध है। कृपया सहायता से संपर्क करें।',
  
  // ===========================================
  // Success Messages
  // ===========================================
  success_saved: 'परिवर्तन सफलतापूर्वक सहेजे गए।',
  success_deleted: 'सफलतापूर्वक हटाया गया।',
  success_sent: 'सफलतापूर्वक भेजा गया।',
  success_verified: 'सफलतापूर्वक सत्यापित।',
  success_updated: 'सफलतापूर्वक अपडेट किया गया।',
  
  // ===========================================
  // Currency
  // ===========================================
  currency_rupees: 'रुपये',
  currency_paise: 'पैसे',
  currency_lakhs: 'लाख',
  currency_crores: 'करोड़',
  
  // ===========================================
  // Accessibility
  // ===========================================
  a11y_skip_to_content: 'मुख्य सामग्री पर जाएं',
  a11y_menu_open: 'मेनू खोलें',
  a11y_menu_close: 'मेनू बंद करें',
  a11y_loading: 'लोड हो रहा है, कृपया प्रतीक्षा करें',
  a11y_amount: '{amount} रुपये',
  a11y_date: 'तिथि: {date}',
  a11y_status: 'स्थिति: {status}',
};

export type HiTranslationKeys = keyof typeof hiTranslations;
