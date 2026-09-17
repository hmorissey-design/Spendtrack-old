/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Download, X, CheckCircle } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  currentTime?: string;
  onRefreshDatabase?: () => void;
}

export function AndroidFrame({ children }: AndroidFrameProps) {
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Capacitor.isNativePlatform() ||
             window.matchMedia('(display-mode: standalone)').matches || 
             (navigator as any).standalone === true ||
             document.referrer.includes('android-app://');
    }
    return false;
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleOpenGuide = () => {
      setShowInstallGuide(true);
    };
    window.addEventListener('open-pwa-install-guide', handleOpenGuide);
    return () => {
      window.removeEventListener('open-pwa-install-guide', handleOpenGuide);
    };
  }, []);

  const renderInstallGuideModal = () => {
    if (!showInstallGuide) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-200 font-sans">
          <button
            onClick={() => setShowInstallGuide(false)}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg cursor-pointer border-0 bg-transparent flex items-center justify-center"
            title="Close Guide"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-2.5 border-b border-white/5 pb-3 mb-4">
            <div className="p-2 bg-emerald-950/20 border border-emerald-500/20 text-[#10b981] rounded-xl flex items-center justify-center">
              <Download size={18} />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">Install LooseBudget PWA</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Add standalone App icon to your home screen or desktop launcher.</p>
            </div>
          </div>

          <div className="space-y-4 font-sans text-xs text-left">
            {/* iOS Guide */}
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1.5">
              <p className="font-extrabold text-emerald-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                📱 iPhone & iPad (Safari)
              </p>
              <ol className="text-[10.5px] text-gray-300 list-decimal list-inside space-y-1 pl-1">
                <li>Open Safari and visit this website.</li>
                <li>Tap the <strong className="text-white font-semibold">Share button</strong> (square with up arrow).</li>
                <li>Scroll down and tap <strong className="text-white font-semibold">Add to Home Screen</strong>.</li>
                <li>Tap <strong className="text-emerald-400 font-bold">Add</strong> at the top right.</li>
              </ol>
            </div>

            {/* Android Guide */}
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1.5">
              <p className="font-extrabold text-[#10b981] text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                🤖 Android (Chrome)
              </p>
              <ol className="text-[10.5px] text-gray-300 list-decimal list-inside space-y-1 pl-1">
                <li>Tap the browser's <strong className="text-white font-semibold">menu icon</strong> (3 dots in top right).</li>
                <li>Tap <strong className="text-white font-semibold">Install App</strong> or <strong className="text-white font-semibold">Add to Home screen</strong>.</li>
                <li>Follow the prompts on screen to confirm.</li>
              </ol>
            </div>

            {/* Desktop Guide */}
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1.5">
              <p className="font-extrabold text-[#10b981] text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                💻 Desktop (Chrome, Edge)
              </p>
              <ol className="text-[10.5px] text-gray-300 list-decimal list-inside space-y-1 pl-1">
                <li>Click the <strong className="text-white font-semibold">Install icon</strong> (monitor with download arrow) inside the URL address bar.</li>
                <li>Or open settings menu (3 dots) and click <strong className="text-white font-semibold">Save and share → Install app</strong>.</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-[#161616] p-2.5 border border-white/5 rounded-xl">
              <CheckCircle size={14} className="text-emerald-400 shrink-0 animate-pulse" />
              <span>Stand-alone PWA apps consume near-zero memory, loads instantly offline, and can be easily uninstalled at any time.</span>
            </div>
          </div>

          <button
            onClick={() => setShowInstallGuide(false)}
            className="mt-5 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer border-0 active:scale-95 text-center font-sans"
          >
            Got It
          </button>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="w-full h-[100dvh] max-h-[100dvh] flex flex-col bg-[#0A0A0A] text-slate-200 select-none relative overflow-hidden animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
        {children}
      </div>
      {renderInstallGuideModal()}
    </div>
  );
}
