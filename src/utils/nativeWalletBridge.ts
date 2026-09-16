/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { WalletSource } from '../types';

export interface NativeDetectedTransaction {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  source: WalletSource;
  packageName?: string;
  rawText?: string;
  timestamp: number;
}

interface WalletBridgePluginInterface {
  isNotificationAccessGranted(): Promise<{ granted: boolean }>;
  openNotificationSettings(): Promise<void>;
  getPendingTransactions(): Promise<{ transactions: NativeDetectedTransaction[] }>;
  addListener(
    eventName: 'transactionDetected',
    listenerFunc: (transaction: NativeDetectedTransaction) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

// Register the custom Capacitor plugin
const WalletBridge = registerPlugin<WalletBridgePluginInterface>('WalletBridge');

export class NativeWalletBridge {
  /**
   * Returns true if running as an installed native Android APK
   */
  static isNativeAndroid(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  /**
   * Checks if Android Notification Access permission is currently granted
   */
  static async checkNotificationAccess(): Promise<boolean> {
    if (!this.isNativeAndroid()) return false;
    try {
      const res = await WalletBridge.isNotificationAccessGranted();
      return !!res?.granted;
    } catch (err) {
      console.warn('Could not check native notification access:', err);
      return false;
    }
  }

  /**
   * Opens the Android OS Notification Listener Access settings screen directly
   */
  static async openNotificationSettings(): Promise<void> {
    if (!this.isNativeAndroid()) return;
    try {
      await WalletBridge.openNotificationSettings();
    } catch (err) {
      console.warn('Could not open native notification settings:', err);
    }
  }

  /**
   * Fetches any transactions caught in the background while the app was asleep
   */
  static async fetchPendingNativeTransactions(): Promise<NativeDetectedTransaction[]> {
    if (!this.isNativeAndroid()) return [];
    try {
      const res = await WalletBridge.getPendingTransactions();
      return res?.transactions || [];
    } catch (err) {
      console.warn('Could not fetch pending native transactions:', err);
      return [];
    }
  }

  /**
   * Subscribes to live transaction detection events from the native Android service
   */
  static subscribe(onTransaction: (tx: NativeDetectedTransaction) => void): () => void {
    if (!this.isNativeAndroid()) {
      return () => {};
    }

    let removeListener: (() => Promise<void>) | null = null;

    WalletBridge.addListener('transactionDetected', (tx) => {
      if (tx && tx.amount > 0 && tx.vendor) {
        onTransaction(tx);
      }
    }).then(handle => {
      removeListener = handle.remove;
    }).catch(err => {
      console.warn('Failed to subscribe to transactionDetected:', err);
    });

    return () => {
      if (removeListener) {
        removeListener().catch(() => {});
      }
    };
  }
}
