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

  // Strip leading and trailing quotation marks, colons, dashes, bullet points and brackets
  clean = clean.replace(/^["'“”‘’«»`:\-•\s]+|["'“”‘’«»`:\-•\s]+$/g, '').trim();

  // Strip POS/Aggregator prefixes
  clean = clean.replace(/^(sq\s*\*|tst\s*\*|sp\s*\*|paypal\s*\*|amzn\s*mktp\s*(us)?\*|stripe\s*\*|clv\s*\*)/i, '');

  // Strip app notification prefixes if present in vendor string
  clean = clean.replace(/^(google wallet|google pay|apple pay|apple wallet|samsung pay|samsung wallet|messages|sms|transaction alert)\s*[:\-•]\s*/i, '');

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
  clean = clean.replace(/^["'“”‘’«»`:\-•\s]+|["'“”‘’«»`:\-•\s]+$/g, '');
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
          if (['bp', 'amc', 'kfc', 'cvs', 'dunkin', 'td', 'rbc', 'bmo', 'cibc', 'at&t', 'pc'].includes(word.toLowerCase())) {
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
    lower === 'payee' ||
    lower === 'google wallet' ||
    lower === 'apple pay' ||
    lower === 'samsung wallet' ||
    lower === 'messages'
  ) {
    return true;
  }
  return (
    lower.includes('card ending') ||
    lower.includes('fraud alert') ||
    lower.includes('account balance') ||
    lower.includes('deposit completed')
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
  // Matches: $11.00, $11, 11.00 USD, USD 11.00, £11.00, €11.00, 11.50 CAD, 11.00$
  const amountRegex = /(?:(\$|USD|CAD|EUR|GBP|€|£)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(\$|USD|CAD|EUR|GBP|€|£))/i;
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
    // Fallback: look for simple number with decimal e.g. "charge of 45.00" or "transaction of 11.00"
    const fallbackNum = trimmed.match(/\b(\d+(?:\.\d{2}))\b/);
    if (fallbackNum) {
      rawAmount = parseFloat(fallbackNum[1]);
    }
  }

  if (isNaN(rawAmount) || rawAmount <= 0) {
    return null; // Not a monetary transaction notification
  }

  // 4. Extract Card digits if available (e.g., "card ending in 5050" or "••5050" or "...5050")
  let cardLast4: string | undefined = undefined;
  const cardMatch = trimmed.match(/(?:card|account|ending in|ending with|\.{3}|••)\s*(?:in\s*)?(\d{4})/i);
  if (cardMatch) {
    cardLast4 = cardMatch[1];
  }

  // 5. Extract Vendor / Retailer
  let rawVendor = '';

  // Strategy A: Multi-line / Delimiter Title Split (Google Wallet Android format)
  // e.g. "CHEERS BEVERAGE ROOM\n$11.00 with PC® World Elite Mastercard ••5050"
  // or "CHEERS BEVERAGE ROOM: $11.00 with PC® World Elite Mastercard ••5050"
  // or "CHEERS BEVERAGE ROOM - $11.00"
  const linesOrParts = trimmed.split(/[\n\r]+|:\s+|\s+-\s+|\s+•\s+/);
  if (linesOrParts.length >= 2) {
    const firstPart = linesOrParts[0].trim();
    const secondPart = linesOrParts.slice(1).join(' ').trim();
    const isFirstGeneric = /^(google wallet|google pay|apple pay|apple wallet|samsung pay|samsung wallet|messages|sms|transaction alert|payment notification)$/i.test(firstPart);

    if (!isFirstGeneric && firstPart.length >= 2 && !firstPart.match(/\$\d+|\b\d+\.\d{2}\b/)) {
      rawVendor = firstPart;
    } else if (isFirstGeneric && linesOrParts.length >= 3) {
      // e.g. "Google Wallet: CHEERS BEVERAGE ROOM: $11.00"
      const secondCandidate = linesOrParts[1].trim();
      if (secondCandidate.length >= 2 && !secondCandidate.match(/\$\d+|\b\d+\.\d{2}\b/)) {
        rawVendor = secondCandidate;
      }
    }
  }

  // Strategy B: "at [Vendor]" (e.g., "charged $14.50 at Starbucks", "Purchase of $25.00 at Trader Joe's")
  if (!rawVendor) {
    const atMatch = trimmed.match(/\bat\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:on|with|for|using|via|card|ending|\d{4})|\.|\,|$|\n)/i);
    if (atMatch && atMatch[1]?.trim()) {
      rawVendor = atMatch[1];
    }
  }

  // Strategy C: "paid [Amount] to [Vendor]" or "sent to [Vendor]"
  if (!rawVendor) {
    const toMatch = trimmed.match(/(?:paid|sent|transfer(?:red)? to)\s+(?:(?:\$|\w+)?\s*\d+(?:\.\d{2})?\s*(?:to\s+)?)?([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:with|using|on|via|from)|\.|\,|$|\n)/i);
    if (toMatch && toMatch[1]?.trim()) {
      rawVendor = toMatch[1];
    }
  }

  // Strategy D: "from [Vendor]" or "charge from [Vendor]"
  if (!rawVendor) {
    const fromMatch = trimmed.match(/(?:charge|transaction|purchase)\s+from\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:for|on|with|via)|\.|\,|$|\n)/i);
    if (fromMatch && fromMatch[1]?.trim()) {
      rawVendor = fromMatch[1];
    }
  }

  // Strategy E: Text before Amount (e.g. "CHEERS BEVERAGE ROOM $11.00 with PC® Mastercard")
  if (!rawVendor) {
    const preAmountMatch = trimmed.match(/^([A-Za-z0-9\s'&.*#\-]{2,40}?)\s+(?:\$|USD|CAD|EUR|GBP|€|£)?\s*\d+(?:\.\d{2})?\s+with\b/i);
    if (preAmountMatch && preAmountMatch[1]?.trim()) {
      const candidate = preAmountMatch[1].trim();
      if (!/^(transaction|purchase|charge|payment|alert)$/i.test(candidate)) {
        rawVendor = candidate;
      }
    }
  }

  // Strategy F: Bank SMS Card Notification without explicit vendor
  // e.g. "A transaction of $11.00 was made on your PC Financial Mastercard ending in 5050 on September 17, 2026."
  if (!rawVendor) {
    const bankCardMatch = trimmed.match(/on\s+your\s+([A-Za-z0-9\s'&.*#\-]+?)\s+(?:ending in|ending with|\d{4}|on\s+\w+)/i);
    if (bankCardMatch && bankCardMatch[1]?.trim()) {
      rawVendor = bankCardMatch[1];
    }
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
      keywords: ['bar', 'pub', 'brewery', 'brewing', 'lounge', 'tavern', 'taproom', 'beer', 'wine', 'spirits', 'liquor', 'beverage', 'beverage room', 'cheers', 'cocktail', 'saloon', 'drinks'],
      targetCategoryKeywords: ['bar', 'beer', 'drinks', 'entertainment', 'restaurant']
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
