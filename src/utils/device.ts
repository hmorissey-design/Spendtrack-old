/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

/**
 * Detects if the current client is a mobile device (smartphone or tablet)
 * where mobile tap-to-pay digital wallets (Google Wallet, Apple Wallet, Samsung Wallet) are supported.
 * On desktop browsers, returns false to avoid confusing desktop users with tap-to-pay auto-detect prompts.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. User agent check for mobile OS (Android, iOS, iPadOS, etc.)
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (isMobileUA) {
    return true;
  }

  // 2. iPadOS Safari desktop mode check (Macintosh with multi-touch points)
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1) {
    return true;
  }

  // 3. Touch device with phone/tablet screen width (<= 820px)
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const isMobileViewport = window.innerWidth <= 820;

  return Boolean(hasTouch && isMobileViewport);
}

/**
 * React hook to reactively track whether the current device is mobile.
 */
export function useIsMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? isMobileDevice() : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
