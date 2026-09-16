/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category, MonthlyBudget } from '../types';
import { 
  DollarSign, Save, Download, Upload, AlertTriangle, CheckCircle, Shield,
  Plus, PlusCircle, Edit, Trash2, Check, Utensils, ShoppingBag, Film, Car, Sparkles, Coffee,
  Briefcase, Gift, Heart, Home, Laptop, Dumbbell, Plane, Users, Phone, HelpCircle, Tag, X,
  Cloud, CloudUpload, CloudDownload, Image as ImageIcon, Eye, ExternalLink, Calendar, TrendingUp,
  Beer, Flame, Train, PiggyBank, Database, RefreshCw, EyeOff, FolderCog, Smartphone, Zap
} from 'lucide-react';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

import dashSplash from '../assets/images/expensetrack_dash_splash_1781301585056.jpg';
import chartsSplash from '../assets/images/expensetrack_charts_splash_1781301595864.jpg';
import budgetSplash from '../assets/images/expensetrack_budget_splash_1781301607200.jpg';
import pdfReportSplash from '../assets/images/expensetrack_pdf_splash_1781301617685.jpg';
import appLogo from '../assets/images/loosebudget_logo_1785685735427.jpg';
import { LocalDb } from '../utils/db';
import { ACCENT_THEMES } from '../utils/theme';

import { SubscriptionState } from '../types';
import { SubscriptionManager } from '../utils/subscription';

interface BudgetSettingsProps {
  categories: Category[];
  currentBudget: MonthlyBudget;
  onBudgetUpdated: (limit: number, limits: Record<string, number>) => void;
  onDatabaseReset: () => void;
  onCategoryAdded?: (category: Omit<Category, 'id'>, isDefault?: boolean) => void;
  onCategoryUpdated?: (category: Category, isDefault?: boolean) => void;
  onCategoryDeleted?: (id: string) => void;
  defaultCategoryId: string;
  currencySymbol: string;
  onCurrencyChanged: (symbol: string) => void;
  isDevMode?: boolean;
  activeThemeId?: string;
  onThemeChanged?: (themeId: string) => void;
  showSimulatedAds?: boolean;
  onShowSimulatedAdsChange?: (val: boolean) => void;
  onLoadDemoData?: () => void;
  onBackupCompleted?: () => void;
  subscriptionState?: SubscriptionState;
  onOpenSubscriptionModal?: () => void;
  isCloudSynced?: boolean;
  onWipeCloudDatabase?: () => Promise<void>;
  onOpenCategoryManager?: () => void;
  openAddOnLaunch?: boolean;
  onOpenAddOnLaunchChange?: (val: boolean) => void;
  onOpenWalletSync?: () => void;
}

// Preset color themes mapping named choices to background text pairings
const COLOR_PRESETS = [
  // Greens
  { label: 'Emerald Spark', value: 'emerald', bgClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', textClass: 'text-emerald-400', hex: '#10b981' },
  { label: 'Forest Green', value: 'green', bgClass: 'bg-green-600/10 text-green-400 border border-green-600/20', textClass: 'text-green-400', hex: '#22c55e' },
  { label: 'Bright Lime', value: 'lime', bgClass: 'bg-lime-500/10 text-lime-400 border border-lime-500/20', textClass: 'text-lime-400', hex: '#84cc16' },

  // Reds / Pinks
  { label: 'Crimson Rose', value: 'rose', bgClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20', textClass: 'text-rose-400', hex: '#f43f5e' },
  { label: 'Ruby Red', value: 'red', bgClass: 'bg-red-500/10 text-red-400 border border-red-500/20', textClass: 'text-red-400', hex: '#ef4444' },
  { label: 'Hot Pink', value: 'pink', bgClass: 'bg-pink-500/10 text-pink-400 border border-pink-500/20', textClass: 'text-pink-400', hex: '#ec4899' },

  // Purples / Indigos
  { label: 'Cosmic Purple', value: 'purple', bgClass: 'bg-purple-500/10 text-purple-400 border border-purple-500/20', textClass: 'text-purple-400', hex: '#8b5cf6' },
  { label: 'Deep Violet', value: 'violet', bgClass: 'bg-violet-600/10 text-violet-400 border border-violet-600/20', textClass: 'text-violet-400', hex: '#7c3aed' },
  { label: 'Royal Indigo', value: 'indigo', bgClass: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', textClass: 'text-indigo-400', hex: '#6366f1' },

  // Blues / Cyans
  { label: 'Ocean Blue', value: 'blue', bgClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', textClass: 'text-blue-400', hex: '#3b82f6' },
  { label: 'Sky Blue', value: 'sky', bgClass: 'bg-sky-500/10 text-sky-400 border border-sky-500/20', textClass: 'text-sky-400', hex: '#0ea5e9' },
  { label: 'Ocean Teal', value: 'teal', bgClass: 'bg-teal-500/10 text-teal-400 border border-teal-500/20', textClass: 'text-teal-400', hex: '#0d9488' },

  // Yellows / Oranges
  { label: 'Amber Glow', value: 'amber', bgClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', textClass: 'text-amber-400', hex: '#f59e0b' },
  { label: 'Gold Yellow', value: 'yellow', bgClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', textClass: 'text-yellow-400', hex: '#eab308' },
  { label: 'Sunset Orange', value: 'orange', bgClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/20', textClass: 'text-orange-400', hex: '#f97316' },

  // Grays / Earthy
  { label: 'Carbon Gray', value: 'slate', bgClass: 'bg-slate-500/10 text-slate-300 border border-slate-500/20', textClass: 'text-slate-400', hex: '#64748b' },
  { label: 'Earthy Stone', value: 'stone', bgClass: 'bg-stone-500/10 text-stone-300 border border-stone-500/20', textClass: 'text-stone-400', hex: '#78716c' },
  { label: 'Cool Zinc', value: 'zinc', bgClass: 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20', textClass: 'text-zinc-400', hex: '#71717a' },
];

const ICON_PRESETS = [
  'Utensils', 'ShoppingBag', 'Film', 'Car', 'Sparkles', 'Coffee', 'Briefcase', 'Gift', 'Heart', 'Home', 'Laptop', 'Dumbbell', 'Plane', 'Users', 'Phone', 'HelpCircle', 'Beer', 'Flame', 'Train'
];

export function renderCategoryIcon(iconName: string, size = 16) {
  switch (iconName) {
    case 'PiggyBank': return <PiggyBank size={size} />;
    case 'Utensils': return <Utensils size={size} />;
    case 'ShoppingBag': return <ShoppingBag size={size} />;
    case 'Film': return <Film size={size} />;
    case 'Car': return <Car size={size} />;
    case 'Sparkles': return <Sparkles size={size} />;
    case 'Coffee': return <Coffee size={size} />;
    case 'Briefcase': return <Briefcase size={size} />;
    case 'Gift': return <Gift size={size} />;
    case 'Heart': return <Heart size={size} />;
    case 'Home': return <Home size={size} />;
    case 'Laptop': return <Laptop size={size} />;
    case 'Dumbbell': return <Dumbbell size={size} />;
    case 'Plane': return <Plane size={size} />;
    case 'Users': return <Users size={size} />;
    case 'Phone': return <Phone size={size} />;
    case 'HelpCircle': return <HelpCircle size={size} />;
    case 'Beer': return <Beer size={size} />;
    case 'Flame': return <Flame size={size} />;
    case 'Train': return <Train size={size} />;
    default: return <Tag size={size} />;
  }
}

export function BudgetSettings({
  categories,
  currentBudget,
  onBudgetUpdated,
  onDatabaseReset,
  onCategoryAdded,
  onCategoryUpdated,
  onCategoryDeleted,
  defaultCategoryId,
  currencySymbol,
  onCurrencyChanged,
  isDevMode = false,
  activeThemeId = 'blue',
  onThemeChanged,
  showSimulatedAds = true,
  onShowSimulatedAdsChange,
  onLoadDemoData,
  onBackupCompleted,
  subscriptionState,
  onOpenSubscriptionModal,
  isCloudSynced = false,
  onWipeCloudDatabase,
  onOpenCategoryManager,
  openAddOnLaunch = true,
  onOpenAddOnLaunchChange,
  onOpenWalletSync
 }: BudgetSettingsProps) {
  const [previewAsset, setPreviewAsset] = useState<{ name: string; url: string } | null>(null);
  const [renderCharts, setRenderCharts] = useState(false);

  useEffect(() => {
    setRenderCharts(false);
    const t = setTimeout(() => {
      setRenderCharts(true);
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const [downloadingAsset, setDownloadingAsset] = useState<boolean>(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleDownloadAsset = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!previewAsset) return;

    if (previewAsset.name === "App Launcher Logo") {
      const link = document.createElement('a');
      link.href = previewAsset.url;
      link.download = previewAsset.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!previewContainerRef.current) return;

    try {
      setDownloadingAsset(true);
      const { toJpeg } = await import('html-to-image');
      
      // Ensure element captures in natural scale and styling
      const dataUrl = await toJpeg(previewContainerRef.current, {
        quality: 0.98,
        backgroundColor: '#000000',
        style: {
          borderRadius: '0px',
        }
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = previewAsset.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to generate dynamic screenshot", err);
      // fallback to static file if error
      const link = document.createElement('a');
      link.href = previewAsset.url;
      link.download = previewAsset.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingAsset(false);
    }
  };

  // Load local expenses on mount or when previewAsset gets updated
  const [localExpenses, setLocalExpenses] = useState<any[]>([]);
  useEffect(() => {
    setLocalExpenses(LocalDb.getExpenses());
  }, [previewAsset]);

  // Restored local backup restore and warning status states
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [deviceRestoreContent, setDeviceRestoreContent] = useState<string>('');
  const [deviceRestoreFilename, setDeviceRestoreFilename] = useState<string>('');
  const [deviceRestoreConfirm, setDeviceRestoreConfirm] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [confirmCloudWipe, setConfirmCloudWipe] = useState<boolean>(false);
  const [isWipingCloud, setIsWipingCloud] = useState<boolean>(false);
  const [showBackupSuccess, setShowBackupSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMonthPrefixVal = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);
  const monthNameVal = useMemo(() => new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }), []);

  const {
    currentMonthExpensesVal,
    totalSpentVal,
    totalLimitVal,
    percentSpentVal,
    remainingAmountVal
  } = useMemo(() => {
    const expensesInMonth = localExpenses.filter(e => e.date.startsWith(currentMonthPrefixVal) && e.category !== 'cat_business_expense' && !e.category.startsWith('SAVINGS_'));
    const spentObj = expensesInMonth.reduce((sum, e) => sum + e.amount, 0);
    const limitObj = categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_') && !c.isHidden).reduce((sum, c) => sum + (c.limit || 0), 0);
    const percentObj = limitObj > 0 ? Math.round((spentObj / limitObj) * 100) : 0;
    const remainingObj = limitObj - spentObj;
    return {
      currentMonthExpensesVal: expensesInMonth,
      totalSpentVal: spentObj,
      totalLimitVal: limitObj,
      percentSpentVal: percentObj,
      remainingAmountVal: remainingObj
    };
  }, [localExpenses, categories, currentMonthPrefixVal]);



  const [showCurrencyManager, setShowCurrencyManager] = useState<boolean>(false);
  const [showThemeManager, setShowThemeManager] = useState<boolean>(false);

  const handleExport = () => {
    const dataStr = LocalDb.exportDatabase();
    
    // Save to localStorage internal backup slot for 1-click restore
    localStorage.setItem('expensetrack_device_backup', dataStr);
    localStorage.setItem('expensetrack_last_backup_time', String(Date.now()));
    
    if (onBackupCompleted) {
      onBackupCompleted();
    }
    
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const fileDateStr = `${year}-${month}-${day}`;
    const exportFileDefaultName = `LooseBudget_backup_${fileDateStr}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    setShowBackupSuccess(true);
  };

  const handleDeviceRestoreClick = () => {
    setErrorMsg(null);
    const storedBackup = localStorage.getItem('expensetrack_device_backup');
    if (!storedBackup) {
      setErrorMsg('No auto-saved backup found in this browser\'s cache.');
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }

    try {
      const parsed = JSON.parse(storedBackup);
      if (Array.isArray(parsed.expenses) && Array.isArray(parsed.categories)) {
        setDeviceRestoreContent(storedBackup);
        
        let formattedDate = 'Unknown date';
        if (parsed.exportedAt) {
          formattedDate = new Date(parsed.exportedAt).toLocaleString();
        } else {
          formattedDate = new Date().toLocaleString();
        }
        
        setDeviceRestoreFilename(`Auto-Saved Cache (${formattedDate})`);
        setDeviceRestoreConfirm(true);
      } else {
        setErrorMsg('The stored backup data appears to be corrupted or invalid.');
        setTimeout(() => setErrorMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg('Failed to read status of stored backup.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleDeviceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setDeviceRestoreFilename(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.expenses) && Array.isArray(parsed.categories)) {
          setDeviceRestoreContent(content);
          setDeviceRestoreConfirm(true);
        } else {
          setErrorMsg('The selected JSON file does not appear to be a valid LooseBudget backup.');
          setDeviceRestoreContent(null);
          setDeviceRestoreConfirm(false);
          setTimeout(() => setErrorMsg(null), 5000);
        }
      } catch (err) {
        setErrorMsg('The selected file is not a valid JSON document.');
        setDeviceRestoreContent(null);
        setDeviceRestoreConfirm(false);
        setTimeout(() => setErrorMsg(null), 5000);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected backup file.');
      setDeviceRestoreContent(null);
      setDeviceRestoreConfirm(false);
      setTimeout(() => setErrorMsg(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeviceRestoreConfirmExecute = () => {
    if (!deviceRestoreContent) return;

    const success = LocalDb.importDatabase(deviceRestoreContent);
    if (success) {
      setSuccessMsg('Your private database has been restored successfully!');
      setErrorMsg(null);
      setDeviceRestoreContent(null);
      setDeviceRestoreConfirm(false);
      setTimeout(() => {
        setSuccessMsg(null);
        window.location.reload();
      }, 1500);
    } else {
      setErrorMsg('Failed to restore database from backup file.');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const cancelDeviceRestore = () => {
    setDeviceRestoreContent(null);
    setDeviceRestoreConfirm(false);
    setDeviceRestoreFilename('');
  };

  const triggerReset = () => {
    onDatabaseReset();
    setConfirmReset(false);
    setSuccessMsg('All custom user transactions have been purged!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-2 p-0.5" id="budget_settings_ui">
      {/* Membership & Subscription Status Card */}
      {subscriptionState && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 text-slate-100 rounded-xl p-4 border border-emerald-500/20 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Membership & Billing
                </span>
              </div>
              <p className="text-sm font-semibold text-white">
                Status: {subscriptionState.isSubscribed
                  ? `Active (${subscriptionState.tier === 'yearly' ? 'Yearly' : 'Monthly'})`
                  : SubscriptionManager.getTrialDaysRemaining(subscriptionState) > 0
                    ? `Free 2-Day Full Access Preview (${SubscriptionManager.getTrialDaysRemaining(subscriptionState)} days remaining)`
                    : 'Preview Expired (Demo / Action-Gated Mode)'}
              </p>
              <p className="text-xs text-slate-400">
                Processed via Lemon Squeezy secure checkout. Multi-device sync & cloud backups enabled.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenSubscriptionModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0"
            >
              <Sparkles size={14} className="text-amber-300" />
              <span>{subscriptionState.isSubscribed ? 'Manage Subscription' : 'Upgrade / View Tiers'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Backup & Data Protection Section - Positioned at Top */}
      <div className="bg-[#111111] text-slate-100 rounded-xl p-3.5 border border-white/5 shadow-2xs animate-in fade-in duration-200">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1.5 font-sans text-center">
          <Shield size={14} className="text-emerald-500 shrink-0" /> {isCloudSynced ? 'Data Protection & Backup' : 'Backup or Restore from Your Device'}
        </h3>

        {isCloudSynced ? (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                <Cloud size={14} className="animate-pulse" />
                <span>Cloud Sync & Automatic Backups Active</span>
              </div>
              <p className="text-[10.5px] text-slate-300 leading-relaxed">
                Your budget and transactions are automatically backed up in real-time to your Cloud Sync account across all devices. Manual device restores are disabled while Cloud Sync is active.
              </p>
            </div>

            <div className="pt-1 flex justify-center">
              <button
                onClick={handleExport}
                className="py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-xl text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
              >
                <Download size={12} className="text-emerald-500 shrink-0" /> Download Offline JSON Copy
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[10.5px] text-slate-300 leading-normal text-center">
              All records remain privately saved on your device only
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-2 animate-in fade-in duration-200">
              <button
                onClick={handleExport}
                className="py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-xl text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
              >
                <Download size={12} className="text-emerald-500 shrink-0" /> Backup to Device
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-xl text-[11px] font-semibold tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
              >
                <Upload size={12} className="text-emerald-500 shrink-0" /> Restore from Device
              </button>
            </div>
          </>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".json" 
          onChange={handleDeviceFileSelect} 
          className="hidden" 
        />

        {deviceRestoreConfirm && (
          <div className="mt-3.5 p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1 text-left">
            <span className="block text-[11px] font-bold text-emerald-400">
              Target Restoration: <span className="font-mono text-slate-300 font-normal">{deviceRestoreFilename}</span>
            </span>
            <p className="text-[10px] text-gray-400 leading-normal">
              Are you sure you want to restore? This will replace all current expenses and categories on this browser with the data from this previous backup.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeviceRestoreConfirmExecute}
                className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all border-0"
              >
                Yes, Overwrite & Restore
              </button>
              <button
                type="button"
                onClick={cancelDeviceRestore}
                className="py-1 px-2.5 bg-white/10 hover:bg-white/15 text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer transition-all border-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg flex items-center gap-1.5 font-sans">
          <CheckCircle size={14} className="text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* Backup Success Confirmation Modal */}
      {showBackupSuccess && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-in fade-in duration-250">
          <div className="w-full max-w-sm bg-[#111111] border border-white/10 rounded-2xl p-6 text-center space-y-4 shadow-2xl relative my-auto animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Backup Successful!
              </h4>
              <p className="text-[11px] text-gray-400 leading-normal">
                Your database backup file has been successfully generated and downloaded to your local device. 
              </p>
              <p className="text-[10px] text-gray-500 leading-normal">
                We've also saved a secure cached copy in your browser for quick one-click restoration anytime from this tab.
              </p>
            </div>

            <div className="text-[11px] text-emerald-400/95 font-medium leading-normal bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl text-left flex items-start gap-2 font-sans">
              <Cloud size={16} className="shrink-0 mt-0.5 text-emerald-400 animate-pulse" />
              <span>
                <strong>Keep it safe:</strong> We highly encourage you to copy/upload this downloaded backup file to your preferred cloud service (like <strong>Google Drive</strong>, <strong>OneDrive</strong>, or <strong>Dropbox</strong>) for ultimate piece of mind!
              </span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowBackupSuccess(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all border-0 cursor-pointer shadow-lg shadow-emerald-950/20 active:scale-95"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories & Category Budgets Management Section */}
      <div className="bg-[#111111] text-slate-100 rounded-xl p-4 border border-white/5 shadow-2xs animate-in fade-in duration-200">
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <FolderCog size={15} className="text-emerald-400 shrink-0" /> Categories & Category Budgets
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Configure spending categories, monthly limits, and toggle visibility for Daily Spending, Known Expenses, and Savings Goals.
            </p>
          </div>
          {onOpenCategoryManager && (
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <FolderCog size={15} />
              <span>Manage Categories</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Visual Accent Theme Swapper Card */}
      <div className="bg-[#111111] text-slate-100 rounded-xl p-3 border border-white/5 shadow-2xs animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setShowThemeManager(true)}
              className="w-full py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
            >
              <Sparkles size={12} className="text-emerald-500 animate-pulse shrink-0" /> Change Colour Theme
            </button>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[9px] text-slate-300 block uppercase font-mono font-bold tracking-wider">Active Theme</span>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 mt-0.5 select-none text-center">
              <span 
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-lg border border-white/10" 
                style={{ backgroundColor: ACCENT_THEMES.find(t => t.id === activeThemeId)?.colors[500] || '#10b981' }} 
              />
              <span className="text-[10px] font-extrabold uppercase font-sans text-emerald-400">
                {ACCENT_THEMES.find(t => t.id === activeThemeId)?.name.replace(' Spark', '').replace(' Sunset', '').replace(' Crimson', '').replace(' Cosmic', '').replace(' Carbon', '').replace(' Ocean', '') || 'Emerald'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Theme Color Dialogue Manager Overlay */}
      {showThemeManager && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-lg flex items-center justify-center z-40 p-4 md:p-6 overflow-y-auto animate-in fade-in duration-250">
          <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-5 text-white shadow-2xl relative my-auto animate-in zoom-in-95 duration-200" id="dialogue_theme_manager">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 font-sans">
              <div>
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Sparkles size={16} className="text-emerald-400" /> Change Colour Theme
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5 font-sans">Select a custom layout accent palette</p>
              </div>
              <button 
                onClick={() => setShowThemeManager(false)} 
                className="text-gray-400 hover:text-white p-1.5 rounded-full cursor-pointer bg-white/5 hover:bg-white/10 border-0 transition-colors"
                title="Close theme setting"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pb-1">
              {ACCENT_THEMES.map((theme) => {
                const isSelected = activeThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onThemeChanged?.(theme.id)}
                    className={`py-3 px-4 rounded-xl border text-[11.5px] font-extrabold uppercase tracking-widest flex items-center justify-between gap-2.5 cursor-pointer transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm'
                        : 'bg-black/25 border-white/5 hover:border-white/10 hover:bg-black/35 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <span className="truncate">{theme.name}</span>
                    <span 
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-lg border border-white/10" 
                      style={{ backgroundColor: theme.colors[500] }} 
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-500 leading-relaxed font-sans border-t border-white/5 pt-3 mb-1">
              This updates standard colors of lines, charts, metrics, buttons, and visual highlights dynamically.
            </p>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowThemeManager(false)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold font-sans text-white text-[11px] uppercase tracking-widest rounded-xl transition-all border-0 cursor-pointer shadow-lg active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Currency Customization Preference Card */}
      <div className="bg-[#111111] text-slate-100 rounded-xl p-3 border border-white/5 shadow-2xs animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setShowCurrencyManager(true)}
              className="w-full py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
            >
              <Sparkles size={12} className="text-emerald-500 animate-pulse shrink-0" /> Change Currency Symbol
            </button>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[9px] text-slate-300 block uppercase font-mono font-bold tracking-wider">Active Symbol</span>
            <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 inline-block">{currencySymbol}</span>
          </div>
        </div>
      </div>

      {/* Main Currency Settings Dialogue Box Manager Overlay */}
      {showCurrencyManager && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-lg flex items-center justify-center z-40 p-4 md:p-6 overflow-y-auto animate-in fade-in duration-250">
          <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-2xl p-6 space-y-5 text-white shadow-2xl relative my-auto animate-in zoom-in-95 duration-200" id="dialogue_currency_manager">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <DollarSign size={16} className="text-emerald-400" /> Currency Settings
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5 font-sans">Select your local symbol for budgeting and lists</p>
              </div>
              <button 
                onClick={() => setShowCurrencyManager(false)} 
                className="text-gray-400 hover:text-white p-1.5 rounded-full cursor-pointer bg-white/5 hover:bg-white/10 border-0 transition-colors"
                title="Close currency setting"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between bg-black/25 p-3 rounded-xl border border-white/5 font-sans">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Symbol</span>
              <span className="text-base font-extrabold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">{currencySymbol}</span>
            </div>

            <p className="text-[11px] text-gray-400 leading-normal font-sans">
              Select your local currency symbol to customize budget targets, transaction lists, and chart metrics across the application.
            </p>

            <div className="grid grid-cols-5 gap-2">
              {['$', '€', '£', '¥', '₹', '₪', '₩', 'Fr', 'A$', 'C$'].map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  onClick={() => onCurrencyChanged(symbol)}
                  className={`py-3 text-center font-mono font-bold text-xs rounded-xl transition-all border cursor-pointer active:scale-95 ${
                    currencySymbol === symbol
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-extrabold shadow-sm shadow-emerald-950/20'
                      : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30 text-gray-400'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowCurrencyManager(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all border-0 cursor-pointer shadow-lg shadow-emerald-950/20 text-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Startup Screen / Quick Launch Preference Card */}
      <div className="bg-[#111111] text-slate-100 rounded-xl p-3 border border-white/5 shadow-2xs animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0 pr-2">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-sans">
              <PlusCircle size={15} className="text-emerald-400 shrink-0" /> Open 'Add Expense' on Startup
            </h4>
            <p className="text-[10.5px] text-slate-400 mt-1 leading-normal">
              Automatically display the Add Transaction screen when opening the app for quick logging.
            </p>
          </div>
          <div className="shrink-0 flex items-center">
            <button
              type="button"
              role="switch"
              aria-checked={openAddOnLaunch}
              onClick={() => onOpenAddOnLaunchChange?.(!openAddOnLaunch)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                openAddOnLaunch ? 'bg-emerald-600' : 'bg-white/10'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  openAddOnLaunch ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Wallet & Notification Auto-Post Sync Card */}
      <div className="bg-gradient-to-r from-emerald-950/30 via-slate-900 to-black text-slate-100 rounded-xl p-3.5 border border-emerald-500/20 shadow-xs animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0 pr-2 space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-emerald-400 shrink-0" />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-sans">
                Wallet & SMS Notification Sync
              </h4>
              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.2 rounded-full border border-emerald-500/30">
                Auto-Detect
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              Auto-detect transactions from Google Wallet, Apple Wallet, Samsung Wallet & bank SMS alerts. Categorize new retailers and auto-post future transactions.
            </p>
          </div>

          <div className="shrink-0">
            {onOpenWalletSync && (
              <button
                type="button"
                onClick={onOpenWalletSync}
                className="w-full sm:w-auto py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-950/30 border-0"
              >
                <Zap size={13} className="fill-current" />
                <span>Configure Sync & Rules</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Database Purge Options (Hidden for Cloud-synced users) */}
      {!isCloudSynced && (
        <div className="bg-rose-950/10 border border-rose-500/10 rounded-xl p-3">
          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <AlertTriangle size={15} /> Reset Local Database
          </h4>
          <p className="text-[11px] text-gray-400 mt-1 leading-normal">
            Delete all local records on this browser and reset the application to a fresh clean state.
          </p>

          <div className="mt-2.5">
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-colors cursor-pointer"
              >
                Reset to Empty Initial Database
              </button>
            ) : (
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-rose-400">Are you sure? All local expense data gets deleted!</span>
                <div className="flex gap-2">
                  <button
                    onClick={triggerReset}
                    className="py-1 px-2.5 bg-rose-600 text-slate-100 text-xs font-bold rounded-md cursor-pointer transition-all border-0"
                  >
                    Yes, Purge Now
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="py-1 px-2.5 bg-[#1C1C1C] hover:bg-[#252525] text-gray-300 text-xs font-semibold rounded-md cursor-pointer transition-all border-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Developer Secret Cloud Database Wipe Option (Visible only in Developer Mode) */}
      {isDevMode && (
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider font-sans">
            <Database size={15} /> Developer Mode: Wipe Cloud & Local Database
          </div>
          <p className="text-[11px] text-gray-400 mt-1 leading-normal">
            Completely purges all user documents in Cloud Firestore (expenses, categories, budgets, income, fixed, savings) as well as local browser storage.
          </p>

          <div className="mt-3">
            {!confirmCloudWipe ? (
              <button
                onClick={() => setConfirmCloudWipe(true)}
                className="py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Wipe Cloud & Local DB (Developer Only)
              </button>
            ) : (
              <div className="space-y-2 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/20">
                <span className="block text-[11px] font-bold text-amber-300">
                  ⚠️ Danger: Wipes ALL cloud database records for this user permanently. Proceed?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setIsWipingCloud(true);
                      if (onWipeCloudDatabase) {
                        await onWipeCloudDatabase();
                      }
                      setIsWipingCloud(false);
                      setConfirmCloudWipe(false);
                    }}
                    disabled={isWipingCloud}
                    className="py-1 px-3 bg-amber-600 hover:bg-amber-500 text-slate-100 text-xs font-bold rounded-md cursor-pointer transition-all border-0 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isWipingCloud ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" /> Wiping Cloud...
                      </>
                    ) : (
                      'Yes, Wipe Everything Now'
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmCloudWipe(false)}
                    disabled={isWipingCloud}
                    className="py-1 px-2.5 bg-[#1C1C1C] hover:bg-[#252525] text-gray-300 text-xs font-semibold rounded-md cursor-pointer transition-all border-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}

// ----------------------------------------------------
// HIGH-FIDELITY LIVE PREVIEW SUBCOMPONENTS
// ----------------------------------------------------

interface ActiveDashboardLiveProps {
  categories: Category[];
  currencySymbol: string;
  totalSpent: number;
  totalLimit: number;
  percentSpent: number;
  remainingAmount: number;
  monthName: string;
  currentMonthExpenses: any[];
}

function RenderActiveDashboardLive({
  categories,
  currencySymbol,
  totalSpent,
  totalLimit,
  percentSpent,
  remainingAmount,
  monthName,
  currentMonthExpenses
}: ActiveDashboardLiveProps) {
  // Let's calculate category stats for rendering
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; limit: number; name: string; color: string }> = {};
    categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_')).forEach(c => {
      stats[c.id] = { total: 0, limit: c.limit || 0, name: c.name, color: c.color };
    });
    currentMonthExpenses.forEach(e => {
      if (stats[e.category]) {
        stats[e.category].total += e.amount;
      }
    });
    return Object.values(stats).filter(s => s.total > 0 || s.limit > 0);
  }, [categories, currentMonthExpenses]);

  // Determine status message
  const statusInfo = useMemo(() => {
    if (percentSpent >= 100) {
      return {
        title: "Over Budget Limit!",
        desc: "Daily spending expenses have exceeded set goals. Limit your expenditures immediately.",
        color: "text-rose-400 border-rose-500/20 bg-rose-500/5"
      };
    } else if (percentSpent >= 80) {
      return {
        title: "Approaching Limit",
        desc: "You have used more than 80% of daily spending limits. Control optional purchases.",
        color: "text-amber-400 border-amber-500/20 bg-amber-500/5"
      };
    } else {
      return {
        title: "Looking Good",
        desc: "Total spending is safe and within your designated target.",
        color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
      };
    }
  }, [percentSpent]);

  return (
    <div className="w-full max-w-sm mx-auto bg-[#0A0A0A] rounded-3xl border border-white/10 shadow-2xl p-5 overflow-hidden flex flex-col gap-4 font-sans text-slate-200 text-left">
      {/* Device Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-400">LB</span>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#eeeeee]">LooseBudget Live</span>
        </div>
        <span className="text-[9px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase">
          Device Frame: Daily Spending
        </span>
      </div>

      {/* Selected Month switcher placeholder */}
      <div className="bg-[#111111] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500 select-none">◀ Prev</span>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-extrabold text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{monthName}</span>
        </div>
        <span className="text-[10px] font-medium text-gray-500 select-none">Next ▶</span>
      </div>

      {/* Main Budget Circular gauge representation */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-white/5">
        <div className="grid grid-cols-12 gap-3 items-center">
          <div className="col-span-5 flex flex-col items-center justify-center">
            <div className="relative w-20 h-20 flex items-center justify-center rounded-full border-4 border-[#1c1c1c] bg-black/40">
              <span className={`absolute inset-0 rounded-full border-4 border-transparent ${
                percentSpent >= 100 ? 'border-t-rose-500 border-r-rose-400' :
                percentSpent >= 80 ? 'border-t-amber-500 border-r-amber-400' : 'border-t-emerald-500 border-r-emerald-400'
              }`} style={{ transform: `rotate(${(percentSpent / 100) * 180}deg)` }}></span>
              <div className="text-center z-10">
                <span className="text-lg font-mono font-bold text-white">{percentSpent}%</span>
                <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider font-mono">Spent</p>
              </div>
            </div>
          </div>

          <div className="col-span-7 space-y-1.5">
            <div>
              <span className="text-[9px] font-semibold text-gray-400 block">Spent this month</span>
              <span className="text-2xl font-mono font-extrabold text-white block leading-none">{currencySymbol}{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex gap-3 border-t border-[#1C1C1C] pt-1.5">
              <div>
                <span className="text-[8px] font-bold text-gray-550 uppercase tracking-tight block">Budget Limit</span>
                <span className="text-[10px] font-bold text-gray-300 font-mono">{currencySymbol}{totalLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-gray-555 uppercase tracking-tight block">Available</span>
                <span className={`text-[10px] font-extrabold font-mono ${remainingAmount >= 0 ? 'text-emerald-404' : 'text-rose-404'}`}>
                  {currencySymbol}{remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar inside mockup */}
        <div className={`mt-3 p-2 border rounded-xl text-[10px] flex items-start gap-1.5 ${statusInfo.color}`}>
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-[10px]">{statusInfo.title}</span>
            <p className="text-[9px] leading-tight text-gray-450 mt-0.5">{statusInfo.desc}</p>
          </div>
        </div>
      </div>

      {/* Category Progress Bars */}
      <div className="bg-[#111111] p-3.5 rounded-2xl border border-white/5 flex-grow min-h-[160px] max-h-[220px] overflow-y-auto space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Category Budgets</span>
          <span className="text-[9px] font-mono text-emerald-400">Live limits</span>
        </div>

        {categoryStats.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-[10px]">
            No daily spending limits configured.
          </div>
        ) : (
          categoryStats.map((stat, i) => {
            const ratio = stat.limit > 0 ? Math.min(Math.round((stat.total / stat.limit) * 100), 100) : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-[10px] leading-none">
                  <span className="font-bold text-gray-200">{stat.name}</span>
                  <span className="font-mono text-gray-400 font-medium">
                    {currencySymbol}{stat.total.toFixed(2)} <span className="text-gray-650 font-bold">/ {currencySymbol}{stat.limit.toFixed(2)}</span>
                  </span>
                </div>
                <div className="w-full bg-black/50 border border-white/5 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      ratio >= 100 ? 'bg-rose-500' : ratio >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} 
                    style={{ width: `${ratio}%` }} 
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface AnalyticsTrendsLiveProps {
  categories: Category[];
  currencySymbol: string;
  currentMonthExpenses: any[];
  monthName: string;
}

function RenderAnalyticsTrendsLive({
  categories,
  currencySymbol,
  currentMonthExpenses,
  monthName
}: AnalyticsTrendsLiveProps) {
  const [renderCharts, setRenderCharts] = useState(false);

  useEffect(() => {
    setRenderCharts(false);
    const t = setTimeout(() => {
      setRenderCharts(true);
    }, 150);
    return () => clearTimeout(t);
  }, []);

  // Compute line graph data
  const trendData = useMemo(() => {
    const daysInMonth = 30;
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      spent: 0,
    }));

    currentMonthExpenses.forEach(e => {
      const dayPart = parseInt(e.date.split('-')[2]);
      if (dayPart >= 1 && dayPart <= daysInMonth) {
        days[dayPart - 1].spent += e.amount;
      }
    });

    let cumulative = 0;
    return days.map(d => {
      cumulative += d.spent;
      return {
        label: `Day ${d.day}`,
        Amount: Math.round(cumulative)
      };
    });
  }, [currentMonthExpenses]);

  // Compute pie chart data
  const pieData = useMemo(() => {
    const stats: Record<string, { total: number; name: string; color: string }> = {};
    categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_')).forEach(c => {
      stats[c.id] = { total: 0, name: c.name, color: c.color };
    });
    currentMonthExpenses.forEach(e => {
      if (stats[e.category]) {
        stats[e.category].total += e.amount;
      }
    });

    const list = Object.values(stats).filter(s => s.total > 0).map(s => {
      let hexColor = '#10b981';
      if (s.color.includes('rose')) hexColor = '#f43f5e';
      else if (s.color.includes('purple')) hexColor = '#8b5cf6';
      else if (s.color.includes('amber')) hexColor = '#f59e0b';
      else if (s.color.includes('blue')) hexColor = '#3b82f6';
      else if (s.color.includes('slate')) hexColor = '#64748b';

      return {
        name: s.name,
        value: s.total,
        color: hexColor
      };
    });

    return list.length > 0 ? list : [{ name: 'Pre-budget tests', value: 350, color: '#10b981' }];
  }, [categories, currentMonthExpenses]);

  return (
    <div className="w-full max-w-sm mx-auto bg-[#0A0A0A] rounded-3xl border border-white/10 shadow-2xl p-5 overflow-hidden flex flex-col gap-4 font-sans text-slate-200 text-left">
      {/* Target Device Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-400">LB</span>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#eeeeee]">LooseBudget Live</span>
        </div>
        <span className="text-[9px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase">
          Device Frame: Analytics
        </span>
      </div>

      {/* Selected month banner layout */}
      <div className="text-[10px] font-bold text-[#eeeeee] uppercase tracking-widest flex items-center gap-1.5 font-sans leading-none">
        <TrendingUp size={13} className="text-emerald-500" />
        <span>Insights Summary ({monthName})</span>
      </div>

      {/* Trend line graph chart */}
      <div className="bg-[#111111] p-3 rounded-2xl border border-white/5">
        <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono">
          Cumulative Spending
        </h4>
        <div className="h-32 w-full text-slate-100 font-mono text-[8px]">
          {renderCharts ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="label" stroke="#64748b" tickSize={4} />
                <YAxis stroke="#64748b" tickSize={4} />
                <ReTooltip 
                  contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}
                  labelStyle={{ fontSize: '9px', fontWeight: 'bold' }}
                  itemStyle={{ fontSize: '9px', color: '#10b981' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Amount" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  dot={{ r: 1.5, fill: '#34d399', strokeWidth: 0 }} 
                  activeDot={{ r: 3 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-32 w-full" />
          )}
        </div>
      </div>

      {/* Pie Chart category distribution card */}
      <div className="bg-[#111111] p-3.5 rounded-2xl border border-white/5 flex-grow max-h-[160px] overflow-y-auto">
        <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-mono">
          wallet share breakdown
        </h4>
        <div className="grid grid-cols-12 gap-3 items-center">
          <div className="col-span-4 h-24 relative">
            {renderCharts ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <RePieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={32}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-24 w-full" />
            )}
          </div>
          <div className="col-span-8 space-y-1.5 overflow-y-auto max-h-24">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[9px] leading-none">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-semibold text-gray-300 truncate w-20 block">{item.name}</span>
                <span className="font-mono text-gray-500 font-bold ml-auto">{currencySymbol}{item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BudgetsCurrencyLiveProps {
  categories: Category[];
  currencySymbol: string;
  totalLimit: number;
}

function RenderBudgetsCurrencyLive({
  categories,
  currencySymbol,
  totalLimit
}: BudgetsCurrencyLiveProps) {
  return (
    <div className="w-full max-w-sm mx-auto bg-[#0A0A0A] rounded-3xl border border-white/10 shadow-2xl p-5 overflow-hidden flex flex-col gap-4 font-sans text-slate-200 text-left">
      {/* Target Device Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-400">LB</span>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#eeeeee]">LooseBudget Live</span>
        </div>
        <span className="text-[9px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase">
          Device Frame: Settings
        </span>
      </div>

      {/* Currency setup and dynamic limits */}
      <div className="bg-[#111111] p-3.5 rounded-2xl border border-white/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-white">Active Currency</h4>
            <p className="text-[8px] text-gray-500 mt-0.5">Applies across all views</p>
          </div>
          <span className="text-xs font-mono font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg">
            {currencySymbol} (USD-Standard)
          </span>
        </div>
      </div>

      {/* Allocated dynamic Master Limit */}
      <div className="bg-[#111111] p-4 rounded-2xl border border-white/5 text-center">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block font-mono">Dynamic Master Goal</span>
        <span className="text-3xl font-mono font-extrabold text-emerald-400 block mt-1 leading-none">{currencySymbol}{totalLimit.toLocaleString()}</span>
        <p className="text-[8px] text-gray-500 italic mt-1 leading-normal">Derived dynamically by the sum of individual category budget sub-limits.</p>
      </div>

      {/* Category individual limits lists */}
      <div className="bg-[#111111] p-3.5 rounded-2xl border border-white/5 flex-grow space-y-2.5 max-h-[180px] overflow-y-auto">
        <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#eeeeee]">Category Budgets</span>
        </div>

        {categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_') && !c.isHidden).map((cat, idx) => (
          <div key={idx} className="flex items-center justify-between text-[10px] bg-black/30 p-2 rounded-xl border border-white/5 leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">{cat.icon === 'Utensils' ? '🍔' : cat.icon === 'ShoppingBag' ? '🛒' : cat.icon === 'Film' ? '🍿' : cat.icon === 'Car' ? '🚗' : '📁'}</span>
              <span className="font-bold text-gray-300">{cat.name}</span>
            </div>
            <span className="font-mono font-extrabold text-emerald-400">
              {currencySymbol}{cat.limit ? cat.limit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FinancePDFReportLiveProps {
  categories: Category[];
  currencySymbol: string;
  localExpenses: any[];
  currentMonthPrefix: string;
  monthName: string;
}

function RenderFinancePDFReportLive({
  categories,
  currencySymbol,
  localExpenses,
  currentMonthPrefix,
  monthName
}: FinancePDFReportLiveProps) {
  // Grab current month expenses, or use fallback mock database if none logged
  const activeReportRows = useMemo(() => {
    let list = localExpenses.filter(e => e.date.startsWith(currentMonthPrefix) && !e.category.startsWith('SAVINGS_'));
    if (list.length === 0) {
      list = [
        { id: '1', date: `${currentMonthPrefix}-02`, note: 'Acme General Store Purchase', category: 'cat_groceries', paymentMethod: 'card', amount: 98.45 },
        { id: '2', date: `${currentMonthPrefix}-08`, note: 'Corporate Logistics Courier', category: 'cat_entertainment', paymentMethod: 'card', amount: 155.00 },
        { id: '3', date: `${currentMonthPrefix}-14`, note: 'Strategic Lunch and Diner Meetup', category: 'cat_restaurants', paymentMethod: 'digital_wallet', amount: 112.50 },
        { id: '4', date: `${currentMonthPrefix}-20`, note: 'Subway Commute Monthly Pass', category: 'cat_business_expense', paymentMethod: 'cash', amount: 45.00 },
      ];
    }
    return list.slice(0, 5);
  }, [localExpenses, currentMonthPrefix]);

  const totalSpentReport = useMemo(() => {
    return activeReportRows.reduce((sum, e) => sum + e.amount, 0);
  }, [activeReportRows]);

  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto bg-stone-50 text-slate-800 rounded-2xl p-5 md:p-6 shadow-2xl border border-stone-200/80 font-sans text-left leading-normal animate-in fade-in zoom-in-95 duration-200">
      {/* Letterhead Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-300 pb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1 bg-[#0F766E]/10 p-1 px-2.5 rounded-lg w-fit">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0F766E] flex items-center justify-center font-bold text-[8px] text-white">L</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-[#0F766E]">LooseBudget Statement</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight leading-snug">Business Expense Ledger</h2>
        </div>
      </div>

      {/* Document Information Grid */}
      <div className="grid grid-cols-2 gap-3 text-[11px] py-1">
        <div>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block font-mono">statement period</span>
          <span className="font-bold text-slate-800 block mt-0.5">{monthName}</span>
          <span className="text-slate-500 block text-[9px] font-mono mt-0.5">Date Mapped: {todayStr}</span>
        </div>
        <div className="text-right">
          {/* Empty right-hand side */}
        </div>
      </div>

      {/* Key Financial KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-100 border border-slate-200/85 p-2 rounded-lg">
          <span className="text-[8px] font-extrabold text-slate-450 uppercase tracking-wider block font-mono">Total Ledger</span>
          <span className="text-sm font-extrabold text-slate-905 font-mono block mt-0.5 leading-none">{currencySymbol}{totalSpentReport.toFixed(2)}</span>
        </div>
        <div className="bg-slate-100 border border-slate-200/85 p-2 rounded-lg">
          <span className="text-[8px] font-extrabold text-slate-450 uppercase tracking-wider block font-mono">Transactions count</span>
          <span className="text-sm font-extrabold text-slate-905 font-mono block mt-0.5 leading-none">{activeReportRows.length} Items</span>
        </div>
        <div className="bg-teal-50 border border-teal-200/70 p-2 rounded-lg">
          <span className="text-[8px] font-extrabold text-teal-600 uppercase tracking-wider block font-mono">Deductible rate</span>
          <span className="text-sm font-extrabold text-teal-805 block mt-0.5 leading-none">100% Taxable</span>
        </div>
      </div>

      {/* Transaction Records Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mt-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 text-[8px] uppercase tracking-wider font-bold">
              <th className="p-2 pl-3">Date</th>
              <th className="p-2">Merchant Name / details</th>
              <th className="p-2">Category</th>
              <th className="p-2">Method</th>
              <th className="p-2 pr-3 text-right font-mono">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {activeReportRows.map((e, idx) => {
              const catObj = categories.find(c => c.id === e.category);
              return (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-2 pl-3 text-[9px] font-mono text-slate-450 leading-none">{e.date}</td>
                  <td className="p-2 font-bold text-slate-900 truncate max-w-[130px] leading-tight">{e.note}</td>
                  <td className="p-2 leading-none"><span className="text-[8px] font-extrabold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 uppercase tracking-wide">{catObj ? catObj.name : "Other Option"}</span></td>
                  <td className="p-2 text-[9px] text-slate-500 uppercase font-semibold leading-none">{e.paymentMethod === 'card' ? 'CARD' : e.paymentMethod === 'digital_wallet' ? 'WALLET' : 'CASH'}</td>
                  <td className="p-2 pr-3 text-right font-mono font-bold text-slate-900 leading-none">{currencySymbol}{e.amount.toFixed(2)}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 border-t border-slate-300 font-bold text-[10px]">
              <td className="p-2.5 pl-3 text-slate-900 uppercase tracking-wider font-extrabold" colSpan={2}>Total Expenses</td>
              <td className="p-2.5"></td>
              <td className="p-2.5"></td>
              <td className="p-2.5 pr-3 text-right font-mono text-slate-900 font-extrabold">{currencySymbol}{totalSpentReport.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Report Footer details and audit Signature line */}
      <div className="flex justify-between items-center bg-slate-100/50 border border-slate-200/50 rounded-xl p-3 text-[9px] text-slate-500 mt-2">
        <div />
        <div className="text-right flex flex-col items-end shrink-0 leading-tight">
          <span className="w-20 h-px bg-slate-350 my-2 block" />
        </div>
      </div>
    </div>
  );
}
