/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Expense {
  id: string;
  amount: number;
  category: string; // ID of the category
  date: string; // YYYY-MM-DD
  note: string;
  paymentMethod: 'cash' | 'card' | 'digital_wallet' | 'other';
  createdAt: number;
  updatedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class or hex
  textColor: string; // Text color class
  isDefault?: boolean;
  limit?: number; // Target budget amount for this category in dollars
  isHidden?: boolean;
}

export interface MonthlyBudget {
  month: string; // YYYY-MM
  limitAmount: number;
  categoryLimits?: Record<string, number>; // Optional category-specific limits
}

export type ActiveTab = 'dashboard' | 'history' | 'analytics' | 'budget_plan' | 'help' | 'dev_hub' | 'budget_full' | 'savings';

export type PlanTier = 'free_preview' | 'trial' | 'monthly' | 'yearly';

export type SubscriptionStatus = 'preview' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export interface SubscriptionState {
  tier: PlanTier;
  status: SubscriptionStatus;
  trialStartDate?: number; // timestamp in ms
  trialDaysTotal: number; // 30
  subscriptionEndDate?: number; // timestamp in ms
  isSubscribed: boolean;
  lemonSqueezyCustomerId?: string;
  lemonSqueezySubscriptionId?: string;
}

export interface AccentTheme {
  id: string;
  name: string;
  colors: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
}

export type WalletSource = 'google_wallet' | 'apple_wallet' | 'samsung_wallet' | 'sms_bank' | 'other_app';

export interface VendorRule {
  id: string;
  vendorPattern: string; // normalized lowercase search key (e.g. "starbucks", "trader joe's")
  displayName: string;   // clean display name (e.g. "Starbucks")
  categoryId: string;    // ID of the assigned category
  autoPost: boolean;     // true: auto-post future transactions; false: ask for review
  createdAt: number;
  updatedAt: number;
  lastAmount?: number;
  totalCount: number;
}

export interface DetectedNotification {
  id: string;
  rawText: string;
  vendor: string;
  amount: number;
  currency?: string;
  date: string; // YYYY-MM-DD
  source: WalletSource;
  appName?: string;
  status: 'pending_first_time' | 'auto_posted' | 'manually_approved' | 'ignored';
  assignedCategoryId?: string;
  detectedAt: number;
  expenseId?: string;
}

export interface WalletSyncSettings {
  enabled: boolean;
  webhookToken: string;
  monitorGoogleWallet: boolean;
  monitorAppleWallet: boolean;
  monitorSamsungWallet: boolean;
  monitorBankApps?: boolean;
  monitorSms: boolean;
  duplicateProtection?: boolean;
  monitoredApps: string[]; // custom apps, e.g. "Chase", "Amex", "Bank of America"
  autoCheckClipboard: boolean;
}

