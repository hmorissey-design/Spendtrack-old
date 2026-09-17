/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WalletSource } from '../types';

export interface ParsedNotification {
  vendor: string;
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  source: WalletSource;
  appName: string;
  cardLast4?: string;
  confidence: number;
}

/**
 * Clean up noisy merchant strings from bank/wallet notifications:
 * e.g., "SQ *BLUE BOTTLE COFFEE #1042" -> "Blue Bottle Coffee"
 * "TST* CHIPOTLE MEXICAN GRILL" -> "Chipotle Mexican Grill"
 * "UBER *TRIP 12345" -> "Uber"
 */
export function cleanVendorName(raw: string): string {
  if (!raw) return 'Unknown Merchant';

  let clean = raw.trim();

  // Strip leading and trailing quotation marks and brackets
  clean = clean.replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, '').trim();

  // Strip POS/Aggregator prefixes
  clean = clean.replace(/^(sq\s*\*|tst\s*\*|sp\s*\*|paypal\s*\*|amzn\s*mktp\s*(us)?\*|stripe\s*\*|clv\s*\*)/i, '');

  // Strip trailing transaction codes, store numbers, phone numbers
  clean = clean.replace(/#\s*\d+/g, '');
  clean = clean.replace(/\bstore\s*#?\s*\d+/gi, '');
  clean = clean.replace(/\bloc(ation)?\s*#?\s*\d+/gi, '');
  clean = clean.replace(/\bpos\s*#?\s*\d+/gi, '');
  clean = clean.replace(/\bterminal\s*#?\s*\d+/gi, '');
  clean = clean.replace(/\b\d{3}-\d{3}-\d{4}\b/g, ''); // phone numbers

  // Strip trailing legal entities
  clean = clean.replace(/\b(llc|inc|corp|corporation|ltd|limited|co|company)\b\.?$/gi, '');

  // Strip web suffixes
  clean = clean.replace(/\.(com|org|net|ca|us|io)\b/gi, '');

  // Strip extra punctuation and multiple spaces
  clean = clean.replace(/[_\-*#]+/g, ' ');
  clean = clean.replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, '');
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  // Convert ALL CAPS or all lower to Title Case for elegant presentation
  if (clean.length > 0) {
    const isAllCaps = clean === clean.toUpperCase() && /[A-Z]/.test(clean);
    const isAllLower = clean === clean.toLowerCase();
    if (isAllCaps || isAllLower) {
      clean = clean
        .toLowerCase()
        .split(' ')
        .map(word => {
          if (!word) return '';
          // Keep common acronyms uppercase
          if (['bp', 'amc', 'kfc', 'cvs', 'dunkin', 'td', 'rbc', 'bmo', 'ciBC', 'at&t'].includes(word.toLowerCase())) {
            return word.toUpperCase();
          }
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    }
  }

  return clean || 'Unknown Merchant';
}

export function isInvalidVendor(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase().trim();
  if (lower.length < 2) return true;
  if (
    lower === 'unknown merchant' ||
    lower === 'merchant' ||
    lower === 'retail store' ||
    lower === 'store' ||
    lower === 'payee'
  ) {
    return true;
  }
  return (
    lower.includes('transaction') ||
    lower.includes('occurred') ||
    lower.includes('card ending') ||
    lower.includes('fraud') ||
    lower.includes('authorized') ||
    lower.includes('alert') ||
    lower.includes('notification') ||
    lower.includes('account balance') ||
    lower.includes('deposit')
  );
}

/**
 * Parses raw notification text (from digital wallet notification) or JSON payload
 */
export function parseNotificationText(
  text: string, 
  preferredSource?: WalletSource
): ParsedNotification | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  const today = new Date().toISOString().split('T')[0];

  // 1. Try parsing JSON (sent by automated iOS Shortcuts or Android Tasker webhook)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);
      const amount = parseFloat(data.amount || data.value || data.total);
      const vendor = data.vendor || data.merchant || data.payee || data.name;
      if (!isNaN(amount) && amount > 0 && vendor) {
        const cleanedVendor = cleanVendorName(String(vendor));
        if (!isInvalidVendor(cleanedVendor)) {
          return {
            vendor: cleanedVendor,
            amount: Math.abs(amount),
            currency: data.currency || '$',
            date: data.date || today,
            source: (data.source as WalletSource) || preferredSource || 'apple_wallet',
            appName: data.appName || 'Wallet Automation',
            confidence: 0.98
          };
        }
      }
    } catch (e) {
      // Fall through to regex text matching
    }
  }

  // 2. Identify Source App / Wallet
  let detectedSource: WalletSource = preferredSource || 'google_wallet';
  let appName = 'Google Wallet';

  const lower = trimmed.toLowerCase();
  if (lower.includes('google wallet') || lower.includes('google pay') || lower.includes('gpay')) {
    detectedSource = 'google_wallet';
    appName = 'Google Wallet';
  } else if (lower.includes('apple wallet') || lower.includes('apple pay') || lower.includes('apple card')) {
    detectedSource = 'apple_wallet';
    appName = 'Apple Wallet';
  } else if (lower.includes('samsung wallet') || lower.includes('samsung pay')) {
    detectedSource = 'samsung_wallet';
    appName = 'Samsung Wallet';
  }

  // 3. Extract Amount & Currency
  // Matches: $12.34, 12.34 USD, USD 12.34, £12.34, €12.34, 12.50 CAD
  const amountRegex = /(?:(\$|USD|CAD|EUR|GBP|€|£)\s*(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s*(\$|USD|CAD|EUR|GBP|€|£))/i;
  const amountMatch = trimmed.match(amountRegex);

  let rawAmount = 0;
  let currency = '$';

  if (amountMatch) {
    if (amountMatch[2]) {
      currency = amountMatch[1];
      rawAmount = parseFloat(amountMatch[2].replace(',', '.'));
    } else if (amountMatch[3]) {
      currency = amountMatch[4];
      rawAmount = parseFloat(amountMatch[3].replace(',', '.'));
    }
  } else {
    // Fallback: look for simple number with decimal e.g. "charge of 45.00"
    const fallbackNum = trimmed.match(/\b(\d+\.\d{2})\b/);
    if (fallbackNum) {
      rawAmount = parseFloat(fallbackNum[1]);
    }
  }

  if (isNaN(rawAmount) || rawAmount <= 0) {
    return null; // Not a monetary transaction notification
  }

  // 4. Extract Card digits if available (e.g., "card ending in 4521" or "card ...4521")
  let cardLast4: string | undefined = undefined;
  const cardMatch = trimmed.match(/(?:card|account|ending in|ending with|\.{3})\s*(?:in\s*)?(\d{4})/i);
  if (cardMatch) {
    cardLast4 = cardMatch[1];
  }

  // 5. Extract Vendor / Retailer
  let rawVendor = '';

  // Pattern A: "at [Vendor]" (e.g., "charged $14.50 at Starbucks", "Purchase of $25.00 at Trader Joe's")
  const atMatch = trimmed.match(/(?:at|with)\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+on|\s+with|\s+for|\s+using|\s+card|\s+ending|\.|\,|$)/i);
  
  // Pattern B: "paid [Amount] to [Vendor]" or "sent to [Vendor]"
  const toMatch = trimmed.match(/(?:paid|sent|transfer(?:red)? to)\s+(?:(?:\$|\w+)?\s*\d+(?:\.\d{2})?\s*(?:to\s+)?)?([A-Za-z0-9\s'&.*#\-]+?)(?:\s+with|\s+using|\s+on|\s+from|\.|\,|$)/i);

  // Pattern C: "from [Vendor]" or "charge from [Vendor]"
  const fromMatch = trimmed.match(/(?:charge|transaction|purchase)\s+from\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+for|\s+on|\.|\,|$)/i);

  // Pattern D: "Google Wallet: Paid [Vendor]" or "Apple Pay: [Vendor]"
  const prefixMatch = trimmed.match(/(?:Google Wallet|Google Pay|Apple Pay|Samsung Pay|Samsung Wallet):\s*(?:Paid\s*)?([A-Za-z0-9\s'&.*#\-]+?)(?:\s+for|\s+\$|\s*\d|\.|\,|$)/i);

  if (atMatch && atMatch[1]?.trim()) {
    rawVendor = atMatch[1];
  } else if (toMatch && toMatch[1]?.trim()) {
    rawVendor = toMatch[1];
  } else if (fromMatch && fromMatch[1]?.trim()) {
    rawVendor = fromMatch[1];
  } else if (prefixMatch && prefixMatch[1]?.trim()) {
    rawVendor = prefixMatch[1];
  } else {
    // If no explicit vendor pattern matched, reject rather than guessing from text fragments
    return null;
  }

  // Clean vendor
  const vendor = cleanVendorName(rawVendor);

  // If vendor came back empty, generic, or matching non-merchant bank text sentences
  if (!vendor || isInvalidVendor(vendor)) {
    return null;
  }

  return {
    vendor,
    amount: rawAmount,
    currency: currency || '$',
    date: today,
    source: detectedSource,
    appName,
    cardLast4,
    confidence: 0.9
  };
}

/**
 * Recommends the best category for a newly detected merchant
 */
export function suggestCategoryForVendor(
  vendor: string, 
  categories: { id: string; name: string }[]
): string {
  const v = (vendor || '').toLowerCase();

  const rules: { keywords: string[]; targetCategoryKeywords: string[] }[] = [
    {
      keywords: ['coffee', 'starbucks', 'dunkin', 'peet', 'tim hortons', 'espresso', 'cafe', 'roasters', 'caribou'],
      targetCategoryKeywords: ['coffee']
    },
    {
      keywords: ['grocery', 'groceries', 'market', 'trader joe', 'whole foods', 'safeway', 'kroger', 'aldi', 'publix', 'costco', 'supermarket', 'wegmans', 'heb', 'sprouts', 'walmart'],
      targetCategoryKeywords: ['groceries', 'grocery']
    },
    {
      keywords: ['gas', 'fuel', 'shell', 'chevron', 'exxon', 'mobil', 'bp', 'citgo', 'texaco', 'speedway', 'wawa', 'circle k', 'auto', 'oil', 'valvoline', 'jiffy lube'],
      targetCategoryKeywords: ['gas', 'auto']
    },
    {
      keywords: ['mcdonald', 'burger king', 'wendy', 'taco bell', 'chipotle', 'chick-fil-a', 'kfc', 'popeyes', 'subway', 'domino', 'pizza hut', 'panda express', 'doordash', 'uber eats', 'grubhub', 'delivery', 'five guys', 'in-n-out', 'fast food'],
      targetCategoryKeywords: ['fast food', 'delivery']
    },
    {
      keywords: ['restaurant', 'bistro', 'diner', 'grill', 'steakhouse', 'sushi', 'tavern', 'kitchen', 'trattoria', 'cantina', 'bbq', 'ramen', 'thai', 'pho'],
      targetCategoryKeywords: ['restaurant']
    },
    {
      keywords: ['bar', 'pub', 'brewery', 'brewing', 'lounge', 'tavern', 'taproom', 'beer', 'wine', 'spirits', 'liquor'],
      targetCategoryKeywords: ['bar', 'beer']
    },
    {
      keywords: ['netflix', 'spotify', 'apple music', 'hulu', 'disney', 'cinema', 'amc', 'regal', 'theatre', 'steam', 'playstation', 'nintendo', 'ticketmaster', 'concert', 'hbo', 'youtube'],
      targetCategoryKeywords: ['entertainment']
    },
    {
      keywords: ['cigar', 'vape', 'tobacco', 'smoke'],
      targetCategoryKeywords: ['smoke', 'smoking']
    },
    {
      keywords: ['office', 'staples', 'ups store', 'fedex', 'aws', 'slack', 'notion', 'zoom', 'adobe', 'godaddy', 'google cloud', 'github'],
      targetCategoryKeywords: ['business']
    }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => v.includes(k))) {
      // Find matching category
      const matchedCat = categories.find(c => {
        const catName = c.name.toLowerCase();
        return rule.targetCategoryKeywords.some(t => catName.includes(t));
      });
      if (matchedCat) {
        return matchedCat.id;
      }
    }
  }

  // Fallback to "cat_uncategorized" if present, or first category
  const uncategorized = categories.find(c => c.id === 'cat_uncategorized' || c.name.toLowerCase().includes('uncategorized'));
  if (uncategorized) return uncategorized.id;

  return categories[0]?.id || 'cat_uncategorized';
}

/**
 * Realistic Sample Presets for Interactive Testing in the Simulator Tab
 */
export const SAMPLE_NOTIFICATION_PRESETS = [
  {
    id: 'preset_google_coffee',
    title: 'Google Wallet • Starbucks Coffee',
    source: 'google_wallet' as WalletSource,
    appName: 'Google Wallet',
    text: 'Google Wallet: Paid $5.45 to Starbucks with Chase Visa ending in 4102',
    vendor: 'Starbucks',
    amount: 5.45,
    suggestedCategoryKeyword: 'coffee'
  },
  {
    id: 'preset_apple_groceries',
    title: 'Apple Wallet • Trader Joe\'s',
    source: 'apple_wallet' as WalletSource,
    appName: 'Apple Wallet',
    text: 'Apple Pay: $48.20 was spent at Trader Joe\'s using Apple Card',
    vendor: "Trader Joe's",
    amount: 48.20,
    suggestedCategoryKeyword: 'groceries'
  },
  {
    id: 'preset_samsung_gas',
    title: 'Samsung Wallet • Shell Gas Station',
    source: 'samsung_wallet' as WalletSource,
    appName: 'Samsung Wallet',
    text: 'Samsung Wallet: Approved $38.50 at Shell Oil Station #8421 with card 9014',
    vendor: 'Shell Oil',
    amount: 38.50,
    suggestedCategoryKeyword: 'gas'
  },
  {
    id: 'preset_google_fastfood',
    title: 'Google Wallet • In-N-Out Burger',
    source: 'google_wallet' as WalletSource,
    appName: 'Google Wallet',
    text: 'Google Wallet: Paid $14.25 to In-N-Out Burger with Chase Visa',
    vendor: 'In-N-Out Burger',
    amount: 14.25,
    suggestedCategoryKeyword: 'fast food'
  },
  {
    id: 'preset_google_groceries',
    title: 'Google Wallet • Whole Foods Market',
    source: 'google_wallet' as WalletSource,
    appName: 'Google Wallet',
    text: 'Google Wallet: Paid $34.80 at Whole Foods Market with Mastercard',
    vendor: 'Whole Foods Market',
    amount: 34.80,
    suggestedCategoryKeyword: 'groceries'
  }
];
