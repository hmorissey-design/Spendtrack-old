/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Zap, 
  Sliders, 
  Trash2, 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  Tag, 
  ShieldCheck, 
  Radio, 
  ChevronDown,
  RefreshCw,
  Edit2
} from 'lucide-react';
import { Category, VendorRule, WalletSyncSettings, WalletSource } from '../types';
import { LocalDb } from '../utils/db';
import { NativeWalletBridge } from '../utils/nativeWalletBridge';
import { renderCategoryIcon } from './BudgetSettings';

interface WalletSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  currencySymbol?: string;
  onSimulateNotification?: (rawText: string, preferredSource?: WalletSource) => void;
  onVendorRuleUpdated?: () => void;
}

export function WalletSyncModal({
  isOpen,
  onClose,
  categories,
  currencySymbol = '$',
  onSimulateNotification,
  onVendorRuleUpdated
}: WalletSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'guide'>('overview');
  const [settings, setSettings] = useState<WalletSyncSettings>(() => LocalDb.getWalletSyncSettings());
  const [vendorRules, setVendorRules] = useState<VendorRule[]>(() => LocalDb.getVendorRules());
  
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCategory, setNewVendorCategory] = useState(categories[0]?.id || 'cat_groceries');
  const [newVendorAutoPost, setNewVendorAutoPost] = useState(true);
  const [showAddRuleForm, setShowAddRuleForm] = useState(false);
  const [isNativeAndroid, setIsNativeAndroid] = useState<boolean>(() => NativeWalletBridge.isNativeAndroid());
  const [nativePermissionGranted, setNativePermissionGranted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setVendorRules(LocalDb.getVendorRules());
      setSettings(LocalDb.getWalletSyncSettings());
      setIsNativeAndroid(NativeWalletBridge.isNativeAndroid());
      NativeWalletBridge.checkNotificationAccess().then(granted => {
        setNativePermissionGranted(granted);
      });
    }
  }, [isOpen]);

  const handleOpenNativeSettings = async () => {
    await NativeWalletBridge.openNotificationSettings();
    setTimeout(async () => {
      const granted = await NativeWalletBridge.checkNotificationAccess();
      setNativePermissionGranted(granted);
    }, 1500);
  };

  if (!isOpen) return null;

  const validCategories = categories.filter(c => !c.id.startsWith('SAVINGS_') && !c.isHidden);

  const handleToggleSetting = (key: keyof WalletSyncSettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(updated);
    LocalDb.saveWalletSyncSettings(updated);
  };

  const handleToggleRuleAutoPost = (ruleId: string) => {
    const rule = vendorRules.find(r => r.id === ruleId);
    if (!rule) return;
    const updated = LocalDb.saveVendorRule({
      ...rule,
      autoPost: !rule.autoPost
    });
    setVendorRules(LocalDb.getVendorRules());
    if (onVendorRuleUpdated) onVendorRuleUpdated();
  };

  const handleChangeRuleCategory = (ruleId: string, categoryId: string) => {
    const rule = vendorRules.find(r => r.id === ruleId);
    if (!rule) return;
    LocalDb.saveVendorRule({
      ...rule,
      categoryId
    });
    setVendorRules(LocalDb.getVendorRules());
    if (onVendorRuleUpdated) onVendorRuleUpdated();
  };

  const handleDeleteRule = (ruleId: string) => {
    LocalDb.deleteVendorRule(ruleId);
    setVendorRules(LocalDb.getVendorRules());
    if (onVendorRuleUpdated) onVendorRuleUpdated();
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    LocalDb.saveVendorRule({
      vendorPattern: newVendorName.trim().toLowerCase(),
      displayName: newVendorName.trim(),
      categoryId: newVendorCategory,
      autoPost: newVendorAutoPost
    });
    setNewVendorName('');
    setShowAddRuleForm(false);
    setVendorRules(LocalDb.getVendorRules());
    if (onVendorRuleUpdated) onVendorRuleUpdated();
  };

  return (
    <div 
      id="modal_wallet_sync_hub"
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#121212] border border-white/10 rounded-2xl shadow-2xl relative flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 text-slate-200 font-sans">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center shadow-md shadow-emerald-950/20">
              <Smartphone size={18} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm uppercase tracking-wider">
                  Digital Wallet Sync
                </h3>
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                Auto-detect transactions from Google Wallet, Samsung Wallet & Apple Wallet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg cursor-pointer border-0 bg-transparent flex items-center justify-center transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-[#0A0A0A] border-b border-white/5 p-1 text-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer border-0 ${
              activeTab === 'overview'
                ? 'bg-white/10 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer border-0 flex items-center justify-center gap-1 ${
              activeTab === 'rules'
                ? 'bg-white/10 text-amber-300 shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span>Retailers</span>
            {vendorRules.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full font-mono">
                {vendorRules.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer border-0 ${
              activeTab === 'guide'
                ? 'bg-white/10 text-emerald-400 shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Phone Setup
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-left">
          
          {/* TAB 1: OVERVIEW & MONITORED APPS */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Native Android Status Banner OR Web Feature Intro */}
              {isNativeAndroid ? (
                nativePermissionGranted ? (
                  <div className="p-3.5 bg-gradient-to-r from-emerald-950/50 via-black to-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-1.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-white">Android Auto-Detect: Active & Listening</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                      Google Wallet, Samsung Wallet, and Apple Pay are captured automatically in the background. When you tap to pay or receive a verified payment confirmation, it's recorded instantly!
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-gradient-to-r from-amber-950/50 via-black to-amber-950/30 border border-amber-500/40 rounded-xl space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-white">Android Auto-Detect: 1-Tap Permission Needed</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Setup
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed font-medium">
                      To automatically record purchases when you tap to pay with Google Wallet or Samsung Pay, grant LooseBudget notification access in Android Settings.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenNativeSettings}
                      className="w-full py-2.5 px-3.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border-0"
                    >
                      <Zap size={14} className="fill-black" />
                      <span>Enable Notification Access in Android Settings</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="p-3 bg-gradient-to-r from-emerald-950/30 via-black to-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-emerald-400 fill-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Automated Transaction Ingestion
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    When a payment notification occurs, LooseBudget parses the merchant and amount. If it's a first-time vendor, you pick the category and choose whether future purchases should be auto-posted instantly!
                  </p>
                </div>
              )}

              {/* Monitored App Channels */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Monitored Payment Wallets & Sources
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  
                  {/* Google Wallet */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🔵</span>
                      <div>
                        <p className="text-xs font-bold text-white">Google Wallet / Pay</p>
                        <p className="text-[9px] text-gray-500 font-mono">Android NFC & Online</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.monitorGoogleWallet}
                      onChange={() => handleToggleSetting('monitorGoogleWallet')}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Samsung Wallet */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">📱</span>
                      <div>
                        <p className="text-xs font-bold text-white">Samsung Wallet / Pay</p>
                        <p className="text-[9px] text-gray-500 font-mono">Galaxy Wallet & MST</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.monitorSamsungWallet}
                      onChange={() => handleToggleSetting('monitorSamsungWallet')}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Apple Wallet (For web/cross-device users) */}
                  <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🍎</span>
                      <div>
                        <p className="text-xs font-bold text-white">Apple Wallet / Apple Pay</p>
                        <p className="text-[9px] text-gray-500 font-mono">iOS Tap to Pay & Cards</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.monitorAppleWallet}
                      onChange={() => handleToggleSetting('monitorAppleWallet')}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Smart 5-Minute Deduplication Protection */}
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">5-Min Duplicate Shield</p>
                        <p className="text-[9px] text-gray-400 leading-tight">
                          Ignores rapid duplicate alerts for the same purchase
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.duplicateProtection ?? true}
                      onChange={() => handleToggleSetting('duplicateProtection' as any)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500/30 accent-emerald-500 cursor-pointer shrink-0"
                    />
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: VENDOR AUTO-POST RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Retailer Auto-Post Rules
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    Control which merchants post directly without asking for confirmation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddRuleForm(prev => !prev)}
                  className="py-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Plus size={11} className="stroke-[3]" />
                  <span>Add Retailer</span>
                </button>
              </div>

              {/* Add rule inline form */}
              {showAddRuleForm && (
                <form onSubmit={handleCreateRule} className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">New Retailer Rule</h5>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Vendor Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Starbucks, Target, Shell"
                      value={newVendorName}
                      onChange={(e) => setNewVendorName(e.target.value)}
                      className="w-full bg-[#181818] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase">Default Category</label>
                    <select
                      value={newVendorCategory}
                      onChange={(e) => setNewVendorCategory(e.target.value)}
                      className="w-full bg-[#181818] border border-white/10 rounded-lg p-2 text-xs text-white outline-none"
                    >
                      {validCategories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="newRuleAutoPost"
                      checked={newVendorAutoPost}
                      onChange={(e) => setNewVendorAutoPost(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="newRuleAutoPost" className="text-xs text-gray-300 font-medium cursor-pointer">
                      Auto-post future transactions without prompting
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddRuleForm(false)}
                      className="py-1 px-3 text-xs text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer border-0"
                    >
                      Save Rule
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List */}
              {vendorRules.length === 0 ? (
                <div className="p-6 bg-black/30 border border-white/5 rounded-xl text-center space-y-2">
                  <Tag size={20} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-400 font-bold">No Retailer Rules Set</p>
                  <p className="text-[10px] text-gray-500 max-w-xs mx-auto leading-normal">
                    When you tap to pay or ingest wallet transactions, your vendor categorization choices will be saved here automatically!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {vendorRules.map(rule => {
                    const cat = categories.find(c => c.id === rule.categoryId);

                    return (
                      <div 
                        key={rule.id} 
                        className="p-3 bg-black/40 border border-white/5 hover:border-white/10 rounded-xl space-y-2 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 text-left">
                            <p className="text-xs font-bold text-white capitalize truncate">
                              {rule.displayName}
                            </p>
                            <p className="text-[9px] text-gray-500 font-mono">
                              {rule.totalCount} transaction{rule.totalCount === 1 ? '' : 's'} recorded
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Auto-Post Switch Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleRuleAutoPost(rule.id)}
                              className={`py-1 px-2 rounded-lg text-[9px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                rule.autoPost
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'bg-white/5 border-white/10 text-gray-400'
                              }`}
                              title="Toggle Auto-Post on/off"
                            >
                              <Zap size={10} className={rule.autoPost ? 'fill-emerald-400' : ''} />
                              <span>{rule.autoPost ? 'Auto-Post ON' : 'Auto-Post OFF'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1 hover:bg-rose-500/20 text-gray-500 hover:text-rose-400 rounded-md transition-colors cursor-pointer border-0 bg-transparent"
                              title="Delete rule"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Category Selector for this rule */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                            Category:
                          </span>
                          <select
                            value={rule.categoryId}
                            onChange={(e) => handleChangeRuleCategory(rule.id, e.target.value)}
                            className="bg-[#1a1a1a] text-xs text-white border border-white/10 rounded-md px-2 py-0.5 outline-none font-sans cursor-pointer max-w-[180px] truncate"
                          >
                            {validCategories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 4: PHONE SETUP & AUTOMATION */}
          {activeTab === 'guide' && (
            <div className="space-y-4 animate-in fade-in duration-150 font-sans">
              
              {/* PRIMARY ZERO-SETUP: ANDROID NATIVE NOTIFICATION AUTO-DETECT */}
              <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-black to-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Android 1-Tap Auto-Detect (No Webhooks)
                      </h4>
                      <p className="text-[10px] text-emerald-400 font-semibold">
                        Native background listener for Google Wallet & Samsung Pay
                      </p>
                    </div>
                  </div>
                  {nativePermissionGranted ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                      Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider">
                      Setup Needed
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  LooseBudget can automatically detect transactions in the background when you tap your phone to pay or receive digital wallet payment notifications.
                </p>

                <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Simple 2-Step Activation:</p>
                  <ol className="text-xs text-gray-200 list-decimal list-inside space-y-1.5 pl-0.5">
                    <li>Tap the <strong className="text-emerald-400">Open Notification Settings</strong> button below.</li>
                    <li>Locate <strong className="text-white">LooseBudget</strong> in the list and switch it to <strong className="text-emerald-400">Allow</strong>.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={handleOpenNativeSettings}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  <Zap size={14} className="fill-slate-950" />
                  <span>{nativePermissionGranted ? 'Open Notification Settings' : 'Enable Notification Access (1-Tap)'}</span>
                </button>

                <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-0.5">
                  <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                  <span>All parsing occurs privately on your device. Zero notification text is sent to third parties.</span>
                </div>
              </div>

              {/* APPLE I-PHONE SETUP */}
              <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍎</span>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      APPLE I-PHONE SETUP
                    </h4>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Automate with Apple Pay & iOS Shortcuts
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-black/60 border border-white/5 rounded-xl space-y-2 text-left">
                  <ol className="text-xs text-gray-300 list-decimal list-inside space-y-2 pl-0.5">
                    <li>
                      Open the <strong className="text-white">Shortcuts</strong> app on your iPhone.
                    </li>
                    <li>
                      Go to <strong className="text-white">Automation</strong> &rarr; <strong className="text-white">New Automation</strong> &rarr; select <strong className="text-emerald-400">Transaction</strong> (Apple Pay).
                    </li>
                    <li>
                      Select your card and choose <strong className="text-emerald-400">Run Immediately</strong>.
                    </li>
                    <li>
                      Add the action <strong className="text-white">Open App</strong> and select <strong className="text-white">ExpenseTrack</strong> so transactions log when you tap to pay.
                    </li>
                  </ol>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-gray-400 pt-0.5">
                  <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                  <span>Runs entirely on your device with no external accounts needed.</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#0A0A0A] border-t border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <Radio size={12} className="text-emerald-400 animate-pulse" />
            <span>Auto-Detect Listening</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-0"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
