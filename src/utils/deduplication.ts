/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WalletSource } from '../types';

export interface RecentTransactionFingerprint {
  id: string;
  amount: number;
  currency: string;
  vendor: string;
  normalizedVendor: string;
  source: WalletSource;
  timestamp: number; // Date.now()
  expenseId?: string;
  rawText?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedTransaction?: RecentTransactionFingerprint;
  reason?: string;
  timeDiffSeconds?: number;
}

const STORAGE_KEY = 'loosebudget_recent_tx_fingerprints';
const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Normalizes a vendor name for robust fuzzy comparison
 * e.g. "Starbucks Coffee #104" -> "starbucks coffee"
 * "TST* CHIPOTLE 204" -> "chipotle"
 */
export function normalizeVendorForMatching(vendor: string): string {
  if (!vendor) return '';
  return vendor
    .toLowerCase()
    .replace(/^(sq\s*\*|tst\s*\*|sp\s*\*|paypal\s*\*|amzn\s*\*|stripe\s*\*)/gi, '')
    .replace(/#\s*\d+/g, '')
    .replace(/\b(store|loc|terminal|pos)\s*#?\s*\d+/gi, '')
    .replace(/\b(llc|inc|corp|ltd|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two vendor names refer to the same merchant
 */
export function areVendorsSimilar(vendorA: string, vendorB: string): boolean {
  const normA = normalizeVendorForMatching(vendorA);
  const normB = normalizeVendorForMatching(vendorB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Check if one contains the other (e.g. "starbucks" and "starbucks coffee")
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Check word token overlap (e.g. "subway sandwiches" and "subway #441")
  const wordsA = normA.split(' ').filter(w => w.length > 2);
  const wordsB = normB.split(' ').filter(w => w.length > 2);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const commonWords = wordsA.filter(w => wordsB.includes(w));
  if (commonWords.length > 0) {
    // If the dominant brand name matches
    return true;
  }

  return false;
}

export class TransactionDeduplicator {
  /**
   * Retrieves recorded fingerprints from the last 24 hours
   */
  static getRecentTransactions(): RecentTransactionFingerprint[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list: RecentTransactionFingerprint[] = JSON.parse(raw);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return list.filter(item => item.timestamp > cutoff);
    } catch {
      return [];
    }
  }

  /**
   * Saves recent transactions to localStorage
   */
  private static saveRecentTransactions(list: RecentTransactionFingerprint[]): void {
    try {
      // Keep only up to 100 recent entries
      const trimmed = list.slice(-100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Checks if an incoming transaction is a duplicate of one seen in the last `windowMs`
   * (e.g. Google Wallet and Bank SMS both firing for the same purchase within 5 minutes)
   */
  static checkDuplicate(
    amount: number,
    vendor: string,
    source: WalletSource,
    windowMs: number = DEFAULT_WINDOW_MS
  ): DuplicateCheckResult {
    const recents = this.getRecentTransactions();
    const now = Date.now();
    const targetNorm = normalizeVendorForMatching(vendor);

    for (const item of recents) {
      const timeDiffMs = Math.abs(now - item.timestamp);
      
      // Outside the deduplication time window?
      if (timeDiffMs > windowMs) continue;

      // Check amount matching (cents precision)
      const isAmountMatch = Math.abs(item.amount - amount) < 0.01;
      if (!isAmountMatch) continue;

      // Check vendor matching
      const isVendorMatch = areVendorsSimilar(vendor, item.vendor) ||
        (targetNorm.length > 2 && item.normalizedVendor.length > 2 && (
          targetNorm.includes(item.normalizedVendor) || item.normalizedVendor.includes(targetNorm)
        ));

      if (isVendorMatch) {
        const diffSec = Math.round(timeDiffMs / 1000);
        const sourceLabel = item.source.replace('_', ' ').toUpperCase();
        return {
          isDuplicate: true,
          matchedTransaction: item,
          timeDiffSeconds: diffSec,
          reason: `Identical purchase ($${amount.toFixed(2)} at ${item.vendor}) detected ${diffSec}s ago via ${sourceLabel}`
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Records a successfully logged or detected transaction
   */
  static recordTransaction(data: {
    id?: string;
    amount: number;
    currency?: string;
    vendor: string;
    source: WalletSource;
    expenseId?: string;
    rawText?: string;
  }): RecentTransactionFingerprint {
    const recents = this.getRecentTransactions();
    const entry: RecentTransactionFingerprint = {
      id: data.id || `tx_fp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      amount: data.amount,
      currency: data.currency || '$',
      vendor: data.vendor,
      normalizedVendor: normalizeVendorForMatching(data.vendor),
      source: data.source,
      timestamp: Date.now(),
      expenseId: data.expenseId,
      rawText: data.rawText
    };

    recents.push(entry);
    this.saveRecentTransactions(recents);
    return entry;
  }

  /**
   * Clears historical fingerprints
   */
  static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
