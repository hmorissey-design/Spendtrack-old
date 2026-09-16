/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Check, 
  X, 
  Store, 
  Zap, 
  Sparkles, 
  Tag, 
  CreditCard, 
  Calendar,
  Smartphone
} from 'lucide-react';
import { Category, WalletSource } from '../types';
import { renderCategoryIcon } from './BudgetSettings';

interface FirstTimeVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  amount: number;
  currencySymbol?: string;
  source: WalletSource;
  appName?: string;
  date?: string;
  suggestedCategoryId: string;
  categories: Category[];
  rawText?: string;
  onConfirm: (data: {
    vendorName: string;
    categoryId: string;
    autoPost: boolean;
    amount: number;
  }) => void;
}

export function FirstTimeVendorModal({
  isOpen,
  onClose,
  vendorName: initialVendorName,
  amount,
  currencySymbol = '$',
  source,
  appName,
  date,
  suggestedCategoryId,
  categories,
  rawText,
  onConfirm
}: FirstTimeVendorModalProps) {
  const [vendorName, setVendorName] = useState(initialVendorName);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(suggestedCategoryId || categories[0]?.id || '');
  const [autoPost, setAutoPost] = useState<boolean>(true);

  if (!isOpen) return null;

  const validCategories = categories.filter(c => !c.id.startsWith('SAVINGS_') && !c.isHidden);

  const getSourceBadge = () => {
    switch (source) {
      case 'google_wallet':
        return {
          label: 'Google Wallet',
          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          icon: '🔵'
        };
      case 'apple_wallet':
        return {
          label: 'Apple Wallet',
          color: 'bg-zinc-700/50 text-white border-zinc-500/30',
          icon: '🍎'
        };
      case 'samsung_wallet':
        return {
          label: 'Samsung Wallet',
          color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          icon: '📱'
        };
      case 'sms_bank':
        return {
          label: appName || 'Bank SMS Alert',
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: '💬'
        };
      default:
        return {
          label: appName || 'App Notification',
          color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          icon: '⚡'
        };
    }
  };

  const badge = getSourceBadge();

  const handleSave = () => {
    if (!vendorName.trim()) return;
    onConfirm({
      vendorName: vendorName.trim(),
      categoryId: selectedCategoryId,
      autoPost,
      amount
    });
  };

  return (
    <div 
      id="modal_first_time_vendor"
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-200 font-sans space-y-4">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg cursor-pointer border-0 bg-transparent flex items-center justify-center transition-colors"
          title="Dismiss"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 border-b border-white/5 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
            <Store size={20} />
          </div>
          <div className="text-left pr-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                First Time Retailer Detected
              </span>
            </div>
            <h3 className="font-extrabold text-white text-base mt-1 tracking-tight">
              Categorize & Set Rule
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              We detected a transaction from an unrecognized vendor. Select its category and choose how future purchases should be handled.
            </p>
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-3.5 bg-black/50 border border-white/5 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${badge.color}`}>
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </span>
            <span className="text-sm font-mono font-black text-emerald-400">
              {currencySymbol}{amount.toFixed(2)}
            </span>
          </div>

          {/* Editable Vendor Name */}
          <div className="space-y-1 text-left">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
              Merchant / Retailer Name
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Merchant name"
              className="w-full bg-[#181818] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white focus:border-emerald-500/50 outline-none transition-all"
            />
          </div>

          {date && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
              <Calendar size={11} className="text-gray-400" />
              <span>{date}</span>
            </div>
          )}

          {rawText && (
            <div className="p-2 bg-black/40 border border-white/5 rounded-lg text-left">
              <span className="text-[8px] font-mono uppercase text-gray-400 block mb-0.5">Original Notification Text</span>
              <p className="text-[10px] text-gray-300 font-mono italic leading-tight break-all">
                "{rawText}"
              </p>
            </div>
          )}
        </div>

        {/* Category Selection Grid */}
        <div className="space-y-2 text-left">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
              <Tag size={12} className="text-emerald-400" />
              <span>Choose Category</span>
            </label>
            <span className="text-[9px] text-gray-400 font-medium">Smart suggestion highlighted</span>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {validCategories.map(cat => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm text-white' 
                      : 'bg-black/30 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                    {renderCategoryIcon(cat.icon, 14)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {cat.name}
                    </p>
                  </div>
                  {isSelected && (
                    <Check size={14} className="text-emerald-400 stroke-[3] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Future Auto-Post Rule Toggle Card */}
        <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/25 rounded-xl text-left space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPost}
              onChange={(e) => setAutoPost(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 shrink-0 cursor-pointer"
            />
            <div className="text-left select-none">
              <div className="flex items-center gap-1.5">
                <Zap size={13} className="text-emerald-400 fill-emerald-400" />
                <span className="text-xs font-bold text-white">
                  Auto-post future transactions from this vendor
                </span>
              </div>
              <p className="text-[10px] text-gray-300 mt-1 leading-relaxed">
                {autoPost ? (
                  <strong className="text-emerald-300">
                    Active: Next time a notification from "{vendorName || 'this merchant'}" occurs, it will automatically post to "{validCategories.find(c => c.id === selectedCategoryId)?.name || 'Category'}" without requiring manual approval.
                  </strong>
                ) : (
                  <span>
                    Off: LooseBudget will always hold future transactions from this vendor for your review first.
                  </span>
                )}
              </p>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 cursor-pointer"
          >
            Ignore
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-emerald-900/20 cursor-pointer flex items-center justify-center gap-1.5 border-0"
          >
            <Check size={14} className="stroke-[3]" />
            <span>Confirm & Record Expense</span>
          </button>
        </div>

      </div>
    </div>
  );
}
