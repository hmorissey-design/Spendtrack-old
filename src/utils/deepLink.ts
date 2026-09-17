/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { App as CapApp } from '@capacitor/app';
import { parseNotificationText, suggestCategoryForVendor, cleanVendorName } from './notificationParser';

export interface DeepLinkExpensePayload {
  action?: string; // 'add' | 'transaction' | 'open'
  amount?: number;
  vendor?: string;
  category?: string;
  note?: string;
  date?: string;
  paymentMethod?: 'cash' | 'card';
  autoSave?: boolean;
  rawText?: string;
  source?: string;
}

type DeepLinkListener = (payload: DeepLinkExpensePayload) => void;

class DeepLinkManagerService {
  private listeners: DeepLinkListener[] = [];
  private initialProcessed = false;

  constructor() {
    this.setupCapacitorListener();
  }

  private setupCapacitorListener() {
    try {
      // Listen for Android deep links when app is running or opened from background
      CapApp.addListener('appUrlOpen', (event) => {
        if (event && event.url) {
          console.log('App opened via deep link:', event.url);
          const parsed = this.parseUrl(event.url);
          if (parsed) {
            this.emit(parsed);
          }
        }
      });
    } catch (e) {
      console.log('Capacitor App plugin not available in this environment');
    }
  }

  /**
   * Parse any supported deep link scheme or web URL:
   * - expensetrack://add?amount=15.50&vendor=Starbucks&category=Coffee&auto=true
   * - expensetrack://add?text=Spent%2014.50%20at%20Subway
   * - expensetrack://transaction?amount=20&merchant=Shell
   * - loosebudget://add?...
   * - https://app.loosebudget.com/add?...
   * - https://...?action=add&amount=15.50&vendor=Starbucks
   */
  public parseUrl(urlString: string): DeepLinkExpensePayload | null {
    if (!urlString || typeof urlString !== 'string') return null;

    try {
      // Normalize URL string for URL parser
      let cleanUrl = urlString.trim();
      
      // Handle custom schemes by replacing with http protocol temporarily for standard URL parsing
      let isCustomScheme = false;
      if (cleanUrl.startsWith('expensetrack://') || cleanUrl.startsWith('loosebudget://')) {
        isCustomScheme = true;
        cleanUrl = cleanUrl.replace(/^(expensetrack|loosebudget):\/\//i, 'https://deep.link/');
      }

      const url = new URL(cleanUrl);
      const searchParams = url.searchParams;
      const pathname = url.pathname.toLowerCase();

      // Determine action from path or query
      const action = searchParams.get('action') || (pathname.includes('add') ? 'add' : pathname.includes('transaction') ? 'transaction' : 'add');

      // 1. Natural Language Voice Query (e.g. from Google Assistant, Gemini voice routines, or speech dictation)
      const voiceText = searchParams.get('text') || searchParams.get('q') || searchParams.get('speech') || searchParams.get('voice') || searchParams.get('prompt') || searchParams.get('query');
      
      let amount: number | undefined = undefined;
      let vendor: string | undefined = undefined;
      let category: string | undefined = undefined;

      if (voiceText) {
        const parsedVoice = parseNotificationText(voiceText);
        if (parsedVoice) {
          amount = parsedVoice.amount;
          vendor = parsedVoice.vendor;
        } else {
          // Regex fallback on voice string
          const amountMatch = voiceText.match(/(?:(\$|USD|CAD|EUR|GBP|€|£)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(\$|USD|CAD|EUR|GBP|€|£)|\b(\d+\.\d{2})\b)/i);
          if (amountMatch) {
            const rawVal = amountMatch[2] || amountMatch[3] || amountMatch[5];
            if (rawVal) amount = parseFloat(rawVal.replace(',', '.'));
          }
          const atMatch = voiceText.match(/\b(?:at|from|to|in)\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:for|on|with)|\.|\,|$)/i);
          if (atMatch && atMatch[1]?.trim()) {
            vendor = cleanVendorName(atMatch[1].trim());
          }
        }
      }

      // 2. Explicit query parameters (take precedence over voice text fallback)
      const rawAmount = searchParams.get('amount') || searchParams.get('val') || searchParams.get('cost') || searchParams.get('price') || searchParams.get('total') || searchParams.get('sum');
      if (rawAmount) {
        const parsedNum = parseFloat(rawAmount.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(parsedNum) && parsedNum > 0) {
          amount = parsedNum;
        }
      }

      const rawVendor = searchParams.get('vendor') || searchParams.get('merchant') || searchParams.get('store') || searchParams.get('payee') || searchParams.get('title') || searchParams.get('name') || searchParams.get('item');
      if (rawVendor) {
        vendor = cleanVendorName(rawVendor);
      }

      const rawCategory = searchParams.get('category') || searchParams.get('cat') || searchParams.get('type');
      if (rawCategory) {
        category = rawCategory.trim();
      }

      const note = searchParams.get('note') || searchParams.get('memo') || searchParams.get('desc') || searchParams.get('description') || voiceText || '';
      const date = searchParams.get('date') || undefined;
      
      const rawPayment = (searchParams.get('payment') || searchParams.get('method') || searchParams.get('paymentMethod') || '').toLowerCase();
      const paymentMethod: 'cash' | 'card' = rawPayment.includes('cash') ? 'cash' : 'card';

      const rawAuto = (searchParams.get('auto') || searchParams.get('save') || searchParams.get('instant') || searchParams.get('autosave') || '').toLowerCase();
      const autoSave = rawAuto === 'true' || rawAuto === '1' || rawAuto === 'yes';

      // If we have an action or amount or vendor or voice text, return the payload
      if (amount || vendor || voiceText || action === 'add' || isCustomScheme) {
        return {
          action,
          amount,
          vendor: vendor || (note ? cleanVendorName(note) : undefined),
          category,
          note: note || vendor || '',
          date,
          paymentMethod,
          autoSave,
          rawText: voiceText || urlString,
          source: 'voice_deep_link'
        };
      }

      return null;
    } catch (e) {
      console.warn('Error parsing deep link URL:', e);
      return null;
    }
  }

  /**
   * Process initial window location params on boot (e.g. for Web, PWA, or initial intent)
   */
  public checkInitialUrl(callback: DeepLinkListener) {
    if (this.initialProcessed || typeof window === 'undefined') return;
    this.initialProcessed = true;

    try {
      const fullHref = window.location.href;
      const parsed = this.parseUrl(fullHref);
      if (parsed && (parsed.amount || parsed.vendor || parsed.rawText || parsed.action === 'add')) {
        // Clean URL params after processing so refreshes don't re-trigger
        setTimeout(() => {
          callback(parsed);
          try {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          } catch {}
        }, 300);
      }
    } catch (e) {
      console.warn('Error checking initial deep link:', e);
    }
  }

  public subscribe(listener: DeepLinkListener): () => void {
    this.listeners.push(listener);
    // Check initial window location on subscription
    this.checkInitialUrl(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(payload: DeepLinkExpensePayload) {
    this.listeners.forEach(listener => {
      try {
        listener(payload);
      } catch (e) {
        console.error('Error in deep link listener:', e);
      }
    });
  }
}

export const DeepLinkManager = new DeepLinkManagerService();
