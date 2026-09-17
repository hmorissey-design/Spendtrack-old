/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  LayoutDashboard, 
  History, 
  PieChart, 
  Sliders, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Eye,
  EyeOff,
  TrendingUp, 
  DollarSign, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  ShieldCheck, 
  Wallet,
  Calendar,
  PiggyBank,
  X,
  CreditCard,
  Building,
  Briefcase,
  Pencil,
  FileSpreadsheet,
  FileText,
  Download,
  HelpCircle,
  MessageSquare,
  AlertTriangle,
  Menu,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Lock,
  Cloud,
  Smartphone,
  Zap,
  Bell
} from 'lucide-react';
import { jsPDF } from 'jspdf';

import { ActiveTab, Expense, Category, MonthlyBudget, SubscriptionState, VendorRule, DetectedNotification, WalletSource } from './types';
import { LocalDb, DEFAULT_CATEGORIES, DEFAULT_INCOME_STREAMS, DEFAULT_FIXED_EXPENSES, DEFAULT_SAVINGS_GOALS } from './utils/db';
import { getLoadedAccentThemeId, applyAccentTheme } from './utils/theme';
import { SubscriptionManager } from './utils/subscription';
import { AndroidFrame } from './components/AndroidFrame';
import { ExpenseForm } from './components/ExpenseForm';
import { BudgetSettings, renderCategoryIcon } from './components/BudgetSettings';
import { CategoryManager } from './components/CategoryManager';
import { AuthModal } from './components/AuthModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { FirstTimeVendorModal } from './components/FirstTimeVendorModal';
import { WalletSyncModal } from './components/WalletSyncModal';
import { parseNotificationText, suggestCategoryForVendor } from './utils/notificationParser';
import { NativeWalletBridge } from './utils/nativeWalletBridge';
import { Capacitor } from '@capacitor/core';
import { TransactionDeduplicator } from './utils/deduplication';
import { HelpSection } from './components/HelpSection';
import { auth, onAuthStateChanged, User } from './firebase';
import { CloudDb, SyncQueue } from './utils/cloudDb';
import appLogo from './assets/images/loosebudget_logo_1785685735427.jpg';

// Recharts components imports
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

const getLocalMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface DirectAmountInputProps {
  initialValue: number;
  onUpdate: (val: number) => void;
  currencySymbol?: string;
  isPercent?: boolean;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

function DirectAmountInput({
  initialValue,
  onUpdate,
  currencySymbol,
  isPercent,
  className,
  placeholder = "0",
  min = 0,
  max
}: DirectAmountInputProps) {
  const formatInitial = (val: number) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
    return rounded.toString();
  };

  const [localValue, setLocalValue] = useState<string>(
    formatInitial(initialValue)
  );

  useEffect(() => {
    setLocalValue(formatInitial(initialValue));
  }, [initialValue]);

  const handleBlurOrSubmit = () => {
    let parsed = parseFloat(localValue);
    if (isNaN(parsed)) parsed = 0;
    
    let finalVal = Math.max(min || 0, parsed);
    if (max !== undefined) {
      finalVal = Math.min(max, finalVal);
    }
    
    finalVal = Math.round((finalVal + Number.EPSILON) * 100) / 100;
    const roundedInitial = Math.round(((initialValue || 0) + Number.EPSILON) * 100) / 100;
    
    if (finalVal !== roundedInitial) {
      onUpdate(finalVal);
    } else {
      setLocalValue(formatInitial(initialValue));
    }
  };

  return (
    <div className="relative">
      {currencySymbol && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 pointer-events-none select-none">
          {currencySymbol}
        </span>
      )}
      <input
        type="number"
        min={min}
        max={max}
        step="0.01"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => {
          if (localValue === '0' || localValue === '0.00' || parseFloat(localValue) === 0) {
            setLocalValue('');
          }
          // Avoid auto-selecting text on touch/mobile devices to prevent native copy popups & highlight visibility issues
          const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
          if (!isTouchDevice) {
            const input = e.currentTarget;
            input.select();
            try {
              input.setSelectionRange(0, input.value.length);
            } catch (err) {}
          }
        }}
        onBlur={handleBlurOrSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className={className}
      />
      {isPercent && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 pointer-events-none select-none">%</span>
      )}
    </div>
  );
}

export function resolveColorHex(colorClass: string): string {
  const lower = (colorClass || '').toLowerCase();
  if (lower.includes('emerald')) return '#10b981';
  if (lower.includes('rose')) return '#f43f5e';
  if (lower.includes('purple')) return '#8b5cf6';
  if (lower.includes('amber')) return '#f59e0b';
  if (lower.includes('blue')) return '#3b82f6';
  if (lower.includes('slate')) return '#64748b';
  if (lower.includes('green')) return '#22c55e';
  if (lower.includes('lime')) return '#84cc16';
  if (lower.includes('red')) return '#ef4444';
  if (lower.includes('pink')) return '#ec4899';
  if (lower.includes('violet')) return '#7c3aed';
  if (lower.includes('indigo')) return '#6366f1';
  if (lower.includes('sky')) return '#0ea5e9';
  if (lower.includes('teal')) return '#0d9488';
  if (lower.includes('cyan')) return '#06b6d4';
  if (lower.includes('yellow')) return '#eab308';
  if (lower.includes('orange')) return '#f97316';
  if (lower.includes('stone')) return '#78716c';
  if (lower.includes('zinc')) return '#71717a';
  return '#a855f7'; // default purple
}

// Safe localStorage fallback wrapper for strict incognito / private browser modes
const safeStorage = (() => {
  const memoryStorage: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return memoryStorage[key] || null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        memoryStorage[key] = value;
      }
    },
    removeItem(key: string): void {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        delete memoryStorage[key];
      }
    }
  };
})();

// Safe sessionStorage fallback wrapper for strict incognito / private browser modes
const safeSessionStorage = (() => {
  const memoryStorage: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      try {
        return window.sessionStorage.getItem(key);
      } catch (e) {
        return memoryStorage[key] || null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.sessionStorage.setItem(key, value);
      } catch (e) {
        memoryStorage[key] = value;
      }
    },
    removeItem(key: string): void {
      try {
        window.sessionStorage.removeItem(key);
      } catch (e) {
        delete memoryStorage[key];
      }
    }
  };
})();

// Shadow global storages safely to capture all operations
const localStorage = safeStorage;
const sessionStorage = safeSessionStorage;

export default function App() {
  // State to track if the dashboard welcome notice banner is visible
  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('expensetrack_welcome_dismissed');
    } catch (e) {
      return true;
    }
  });

  // State to toggle mock simulated Ad slots (top and bottom banners)
  const [showSimulatedAds, setShowSimulatedAds] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('expensetrack_show_ads');
      return stored !== null ? stored === 'true' : true;
    } catch (e) {
      return true;
    }
  });

  const handleShowSimulatedAdsChange = (val: boolean) => {
    try {
      localStorage.setItem('expensetrack_show_ads', String(val));
    } catch (e) {}
    setShowSimulatedAds(val);
  };

  // Detect session state to distinguish launching fresh (closed state) vs accidental page refresh
  const isSessionActive = useMemo(() => {
    try {
      const active = sessionStorage.getItem('expensetrack_session_active');
      if (!active) {
        sessionStorage.setItem('expensetrack_session_active', 'true');
        return false; // This is a fresh app boot from a closed state
      }
      return true; // The app was already open and is being refreshed
    } catch (e) {
      return false;
    }
  }, []);

  // Subscription & Paywall state management
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(() => {
    return SubscriptionManager.getSubscriptionState();
  });
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Initialize active tab - default to 'dashboard' (Daily Overview)
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [accentThemeId, setAccentThemeId] = useState<string>(getLoadedAccentThemeId);
  const [renderCharts, setRenderCharts] = useState(false);
  const [showHiddenSavingsGoals, setShowHiddenSavingsGoals] = useState(false);

  // Firebase Auth & Cloud Sync states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Digital Wallet & Notification Monitoring states
  const [showWalletSyncModal, setShowWalletSyncModal] = useState<boolean>(false);
  const [firstTimeVendorData, setFirstTimeVendorData] = useState<{
    vendorName: string;
    amount: number;
    currencySymbol?: string;
    source: WalletSource;
    appName?: string;
    date?: string;
    suggestedCategoryId: string;
    rawText: string;
    notifId?: string;
  } | null>(null);

  const [autoPostToast, setAutoPostToast] = useState<{
    message: string;
    vendor: string;
    amount: number;
    categoryName: string;
    expenseId: string;
  } | null>(null);

  // Developer Secret Shortcut: 5 quick taps on logo toggles PRO / Trial state & Dev Mode
  const logoTapCountRef = useRef<number>(0);
  const logoTapTimerRef = useRef<any>(null);
  const [devNotice, setDevNotice] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const unsubRealtimeRef = useRef<(() => void) | null>(null);

  const handleLogoTap = () => {
    logoTapCountRef.current += 1;
    if (logoTapTimerRef.current) {
      clearTimeout(logoTapTimerRef.current);
    }

    if (logoTapCountRef.current >= 5) {
      logoTapCountRef.current = 0;
      const nextDevState = !isDevMode;
      setIsDevMode(nextDevState);
      if (subscriptionState.isSubscribed && !nextDevState) {
        // Toggle OFF Dev Pro -> Reset to standard trial
        const updated = SubscriptionManager.startTrial();
        setSubscriptionState(updated);
        setDevNotice('🔒 Developer Mode Deactivated');
      } else {
        // Toggle ON Dev Pro -> Activate Pro membership
        const updated = SubscriptionManager.activatePlan('yearly');
        setSubscriptionState(updated);
        setDevNotice('🔓 Developer PRO & Cloud Options Unlocked');
      }
      setTimeout(() => setDevNotice(null), 3500);
    } else {
      logoTapTimerRef.current = setTimeout(() => {
        logoTapCountRef.current = 0;
      }, 2000);
    }
  };

  // Derived Demo Mode flag (active when trial expired and unsubscribed)
  const isDemoMode = !subscriptionState.isSubscribed && SubscriptionManager.isPaywalled(subscriptionState);

  // Auto-check trial expiration on app boot & handle payment redirect back from Lemon Squeezy
  useEffect(() => {
    // 1. Check for payment return query params
    try {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get('payment');
      const success = params.get('success');
      const status = params.get('status');
      const plan = params.get('plan');
      const action = params.get('action');

      if (action === 'add') {
        setShowAddForm(true);
      }

      const isSuccessSignal = payment === 'success' || success === 'true' || status === 'success' || Boolean(plan);

      if (isSuccessSignal) {
        const activePlan = (plan === 'monthly' || plan === 'yearly') ? (plan as 'monthly' | 'yearly') : 'yearly';
        const updated = SubscriptionManager.activatePlan(activePlan);
        setSubscriptionState(updated);
        // Clean URL query params without triggering page reload
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.warn('Error processing payment redirect:', e);
    }

    // 2. Check if user is paywalled (trial expired and unsubscribed)
    if (SubscriptionManager.isPaywalled(subscriptionState)) {
      setShowSubscriptionModal(true);
    }

    // 3. Custom event listener for opening cloud sync auth modal
    const handleOpenCloudSync = () => {
      setShowAuthModal(true);
    };
    window.addEventListener('open-cloud-sync-modal', handleOpenCloudSync);
    return () => {
      window.removeEventListener('open-cloud-sync-modal', handleOpenCloudSync);
    };
  }, []);

  // Delay rendering charts slightly to let elements mount and establish positive dimensions.
  // This suppresses Recharts ResponsiveContainer warnings (width/height of -1 or 0)
  useEffect(() => {
    setRenderCharts(false);
    const t = setTimeout(() => {
      setRenderCharts(true);
    }, 150);
    return () => clearTimeout(t);
  }, [activeTab]);

  // Apply accent theme dynamically
  useEffect(() => {
    applyAccentTheme(accentThemeId);
  }, [accentThemeId]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return getLocalMonthString(); // e.g. "YYYY-MM"
  });
  const [currentBudget, setCurrentBudget] = useState<MonthlyBudget>({ month: '', limitAmount: 1000 });
  const [openAddOnLaunch, setOpenAddOnLaunch] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('expensetrack_open_add_on_launch');
      return saved === null ? true : saved === 'true';
    } catch (e) {
      return true;
    }
  });

  const handleOpenAddOnLaunchChange = (val: boolean) => {
    try {
      localStorage.setItem('expensetrack_open_add_on_launch', String(val));
    } catch (e) {}
    setOpenAddOnLaunch(val);
  };

  const [showAddForm, setShowAddForm] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'add') {
        return true;
      }
      const saved = localStorage.getItem('expensetrack_open_add_on_launch');
      return saved === null ? true : saved === 'true';
    } catch (e) {
      return true;
    }
  });
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [defaultCategoryId, setDefaultCategoryIdState] = useState<string>('');
  const [currencySymbol, setCurrencySymbol] = useState<string>(() => {
    return LocalDb.getCurrencySymbol();
  });

  // Simulated Full Budget Monthly Planner states (under construction preview)
  const [incomeStreams, setIncomeStreams] = useState<{ id: string; label: string; amount: number; isHidden?: boolean }[]>(() => {
    const defaultList = [
      { id: 'net_salary', label: 'Salary', amount: 0 },
      { id: 'side_income', label: 'Govt Pensions', amount: 0 },
      { id: 'private_pension', label: 'Private Pension', amount: 0 }
    ];

    try {
      const stored = localStorage.getItem('expensetrack_income_streams');
      if (stored) {
        const parsed = JSON.parse(stored);
        const legacyDefaults: Record<string, number> = {
          net_salary: 4000,
          side_income: 500
        };
        let modified = false;
        const cleaned = parsed.map((item: any) => {
          if (legacyDefaults[item.id] !== undefined && item.amount === legacyDefaults[item.id]) {
            modified = true;
            return { ...item, amount: 0 };
          }
          return item;
        });

        const existingMap = new Map<string, { id: string; label: string; amount: number }>();
        cleaned.forEach((item: any) => {
          if (item && item.id) {
            existingMap.set(item.id, item);
          }
        });

        const mergedList: { id: string; label: string; amount: number }[] = [];
        defaultList.forEach(defItem => {
          if (existingMap.has(defItem.id)) {
            const existing = existingMap.get(defItem.id)!;
            mergedList.push({
              id: defItem.id,
              label: existing.label || defItem.label,
              amount: existing.amount !== undefined ? existing.amount : defItem.amount
            });
            existingMap.delete(defItem.id);
          } else {
            modified = true;
            mergedList.push({ ...defItem });
          }
        });

        existingMap.forEach(customItem => {
          mergedList.push(customItem);
        });

        if (modified) {
          localStorage.setItem('expensetrack_income_streams', JSON.stringify(mergedList));
        }
        return mergedList;
      }
    } catch (e) {}
    return defaultList;
  });

  const [fixedExpenses, setFixedExpenses] = useState<{ id: string; label: string; amount: number; isHidden?: boolean }[]>(() => {
    const defaultList = [
      { id: 'mortgage_rent', label: 'Rent/Mortgage', amount: 0 },
      { id: 'property_tax', label: 'Property Taxes', amount: 0 },
      { id: 'property_insurance', label: 'Property Insurance', amount: 0 },
      { id: 'power', label: 'Power', amount: 0 },
      { id: 'water', label: 'Water', amount: 0 },
      { id: 'phone', label: 'Home Phone', amount: 0 },
      { id: 'mobile_phone', label: 'Mobile Phone', amount: 0 },
      { id: 'cable_internet', label: 'Cable/Internet', amount: 0 },
      { id: 'loan_auto', label: 'Auto Loan', amount: 0 },
      { id: 'auto_insurance', label: 'Auto Insurance', amount: 0 },
      { id: 'health_insurance', label: 'Health Insurance', amount: 0 },
      { id: 'bank_fee', label: 'Banking Fees', amount: 0 }
    ];

    try {
      const stored = localStorage.getItem('expensetrack_fixed_expenses');
      if (stored) {
        const parsed = JSON.parse(stored);
        let modified = false;
        
        // Map old IDs to new default IDs if present
        const cleaned = parsed.map((item: any) => {
          let updated = { ...item };
          if (updated.id === 'electricity') {
            updated.id = 'power';
            updated.label = 'Power';
            modified = true;
          }
          if (updated.id === 'cable' || updated.id === 'internet') {
            updated.id = 'cable_internet';
            updated.label = 'Cable/Internet';
            modified = true;
          }
          if (updated.id === 'loan_auto' && updated.label === 'Loan Auto') {
            updated.label = 'Auto Loan';
            modified = true;
          }
          if (updated.id === 'bank_fee' && updated.label === 'Banking fees') {
            updated.label = 'Banking Fees';
            modified = true;
          }
          if (updated.id === 'mortgage_rent' && updated.label === 'Mortgage / Rent') {
            updated.label = 'Rent/Mortgage';
            modified = true;
          }
          if (updated.id === 'property_tax' && updated.label === 'Property Tax') {
            updated.label = 'Property Taxes';
            modified = true;
          }
          return updated;
        });

        const existingMap = new Map<string, { id: string; label: string; amount: number }>();
        cleaned.forEach((item: any) => {
          if (item && item.id) {
            existingMap.set(item.id, item);
          }
        });

        // Remove obsolete legacy defaults
        if (existingMap.has('condo_fees')) {
          existingMap.delete('condo_fees');
          modified = true;
        }

        const mergedList: { id: string; label: string; amount: number; isHidden?: boolean }[] = [];
        defaultList.forEach(defItem => {
          if (existingMap.has(defItem.id)) {
            const existing = existingMap.get(defItem.id)!;
            mergedList.push({
              id: defItem.id,
              label: existing.label || defItem.label,
              amount: existing.amount !== undefined ? existing.amount : defItem.amount,
              isHidden: (existing as any).isHidden
            });
            existingMap.delete(defItem.id);
          } else {
            modified = true;
            mergedList.push({ ...defItem });
          }
        });

        existingMap.forEach(customItem => {
          mergedList.push(customItem);
        });
        
        if (modified) {
          localStorage.setItem('expensetrack_fixed_expenses', JSON.stringify(mergedList));
        }
        return mergedList;
      }
    } catch (e) {}
    return defaultList;
  });

  const [savingsGoals, setSavingsGoals] = useState<{ id: string; label: string; amount: number; targetAmount?: number; currentAmount?: number; allocationPercent?: number; isHidden?: boolean }[]>(() => {
    const defaultList = [
      { id: 'emergency_fund', label: 'Reserve', amount: 0, targetAmount: 1, currentAmount: 0, allocationPercent: 25 },
      { id: 'clothes_fund', label: 'Clothes', amount: 0, targetAmount: 1, currentAmount: 0, allocationPercent: 25 },
      { id: 'auto_maint_fund', label: 'Auto Maintenance', amount: 0, targetAmount: 1, currentAmount: 0, allocationPercent: 25 },
      { id: 'income_tax_fund', label: 'Income Tax', amount: 0, targetAmount: 1, currentAmount: 0, allocationPercent: 25 }
    ];

    try {
      const stored = localStorage.getItem('expensetrack_savings_goals');
      if (stored) {
        const parsed = JSON.parse(stored);
        let modified = false;

        const existingMap = new Map<string, any>();
        parsed.forEach((item: any) => {
          if (item && item.id) {
            existingMap.set(item.id, item);
          }
        });

        // Remove obsolete legacy defaults like vacation_fund
        if (existingMap.has('vacation_fund')) {
          existingMap.delete('vacation_fund');
          modified = true;
        }
        if (existingMap.has('vacation')) {
          existingMap.delete('vacation');
          modified = true;
        }

        const mergedList: any[] = [];
        defaultList.forEach(defGoal => {
          if (existingMap.has(defGoal.id)) {
            const existing = existingMap.get(defGoal.id)!;
            let updated = { ...existing };
            if (!updated.label) {
              updated.label = defGoal.label;
              modified = true;
            }
            if (updated.targetAmount === undefined || updated.targetAmount === 0 || updated.targetAmount === 500) {
              updated.targetAmount = defGoal.targetAmount;
              modified = true;
            }
            if (updated.allocationPercent === undefined || updated.allocationPercent === 50) {
              updated.allocationPercent = defGoal.allocationPercent;
              modified = true;
            }
            mergedList.push(updated);
            existingMap.delete(defGoal.id);
          } else {
            modified = true;
            mergedList.push({ ...defGoal });
          }
        });

        existingMap.forEach(customItem => {
          mergedList.push(customItem);
        });

        if (modified) {
          localStorage.setItem('expensetrack_savings_goals', JSON.stringify(mergedList));
        }
        return mergedList;
      }
    } catch (e) {}
    return defaultList;
  });

  // Accordion active toggles (initially collapsed by default)
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({
    income: false,
    fixed: false,
    discretionary: false,
    savings: false
  });

  const toggleAccordion = (key: string) => {
    setAccordionOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isDuplicateName = (name: string, section: 'income' | 'fixed' | 'category' | 'savings', excludeId?: string): boolean => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) return false;

    if (section === 'income') {
      return incomeStreams.some(item => item.id !== excludeId && item.label.trim().toLowerCase() === cleanName);
    }
    if (section === 'fixed') {
      return fixedExpenses.some(item => item.id !== excludeId && item.label.trim().toLowerCase() === cleanName);
    }
    if (section === 'category') {
      return categories.some(item => item.id !== excludeId && !item.isHidden && item.name.trim().toLowerCase() === cleanName);
    }
    if (section === 'savings') {
      return savingsGoals.some(item => item.id !== excludeId && !item.isHidden && item.label.trim().toLowerCase() === cleanName);
    }
    return false;
  };

  useEffect(() => {
    try {
      localStorage.setItem('expensetrack_income_streams', JSON.stringify(incomeStreams));
    } catch (e) {}
  }, [incomeStreams]);

  useEffect(() => {
    try {
      localStorage.setItem('expensetrack_fixed_expenses', JSON.stringify(fixedExpenses));
    } catch (e) {}
  }, [fixedExpenses]);

  useEffect(() => {
    try {
      localStorage.setItem('expensetrack_savings_goals', JSON.stringify(savingsGoals));
      setCategories(LocalDb.getCategories(selectedMonth));
    } catch (e) {}
  }, [savingsGoals, selectedMonth]);

  const getPreviousMonthName = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  // Adding custom income / fixed expense / savings goals states
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [newFixedName, setNewFixedName] = useState('');
  const [newFixedAmount, setNewFixedAmount] = useState('');
  const [newSavingsName, setNewSavingsName] = useState('');
  const [newSavingsAmount, setNewSavingsAmount] = useState('');
  const [newSavingsTarget, setNewSavingsTarget] = useState('');
  const [newSavingsCurrent, setNewSavingsCurrent] = useState('');
  const [newSavingsPercent, setNewSavingsPercent] = useState('');
  const [newDiscretionaryName, setNewDiscretionaryName] = useState('');
  const [newDiscretionaryLimit, setNewDiscretionaryLimit] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});
  const [savingsGoalError, setSavingsGoalError] = useState<string | null>(null);

  // Reconciliation states
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [reconciliationStep, setReconciliationStep] = useState(1);
  const [chequingBalance, setChequingBalance] = useState('');
  const [savingsBalance, setSavingsBalance] = useState('');
  const [cashOnHand, setCashOnHand] = useState('');
  const [tempSavingsGoals, setTempSavingsGoals] = useState<any[]>([]);
  const [dismissedReconciliationBanner, setDismissedReconciliationBanner] = useState(() => {
    try {
      const today = new Date().toDateString();
      return localStorage.getItem('dismissed_reconciliation_date') === today;
    } catch (e) {}
    return false;
  });

  const isLastDayOfMonth = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return tomorrow.getDate() === 1;
  }, []);

  const isTrialActive = useMemo(() => {
    return !subscriptionState.isSubscribed && subscriptionState.tier === 'trial' && SubscriptionManager.getTrialDaysRemaining(subscriptionState) > 0;
  }, [subscriptionState]);

  const hasEnteredBudgetData = useMemo(() => {
    const hasCategoryLimits = categories.some(c => (c.limit || 0) > 0);
    const hasIncome = incomeStreams.some(i => (i.amount || 0) > 0);
    const hasFixedExpenses = fixedExpenses.some(f => (f.amount || 0) > 0);
    const hasExpenses = expenses.length > 0;
    return hasCategoryLimits || hasIncome || hasFixedExpenses || hasExpenses;
  }, [categories, incomeStreams, fixedExpenses, expenses]);

  const currentReconciliationMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const hasRunReconciliationThisMonth = (() => {
    try {
      return localStorage.getItem('last_reconciliation_month') === currentReconciliationMonthKey;
    } catch (e) {
      return false;
    }
  })();

  useEffect(() => {
    if (showReconciliationModal) {
      let baselines: Record<string, number> = {};
      if (hasRunReconciliationThisMonth) {
        try {
          const storedBaselines = localStorage.getItem('reconciliation_baseline_goals');
          if (storedBaselines) {
            baselines = JSON.parse(storedBaselines);
          }
        } catch (e) {
          console.error('Error loading baselines', e);
        }
      }

      setTempSavingsGoals(savingsGoals.filter(g => !g.isHidden).map(g => {
        const baselineAmount = (hasRunReconciliationThisMonth && baselines[g.id] !== undefined)
          ? baselines[g.id]
          : (g.currentAmount || 0);
        return {
          ...g,
          allocationPercent: g.allocationPercent || 0,
          currentAmount: baselineAmount,
          targetAmount: g.targetAmount || 0
        };
      }));
    }
  }, [showReconciliationModal, savingsGoals, hasRunReconciliationThisMonth]);

  // Inline editing of names / labels states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState<string>('');

  const [itemToDelete, setItemToDelete] = useState<{
    type: 'income' | 'fixed' | 'savings' | 'category';
    id: string;
    name: string;
  } | null>(null);

  // Unified quick add states
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddSection, setQuickAddSection] = useState<'income' | 'fixed' | 'discretionary' | 'savings'>('fixed');
  const [quickAddAmount, setQuickAddAmount] = useState('');

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim()) return;
    const amount = parseFloat(quickAddAmount) || 0;
    const label = quickAddName.trim();

    const mappedSection = quickAddSection === 'discretionary' ? 'category' : quickAddSection;
    if (isDuplicateName(label, mappedSection)) {
      alert(`The name "${label}" is already in use in another section or category. Please choose a unique name.`);
      return;
    }

    if (quickAddSection === 'income') {
      const newItem = {
        id: `income_${Date.now()}`,
        label,
        amount
      };
      setIncomeStreams(prev => [...prev, newItem]);
    } else if (quickAddSection === 'fixed') {
      if (label.toLowerCase().includes('savings')) {
        alert("Known commitment / Fixed expense names cannot contain the word 'savings' to prevent conflict with Savings Goal categories.");
        return;
      }
      const newItem = {
        id: `fixed_${Date.now()}`,
        label,
        amount
      };
      setFixedExpenses(prev => [...prev, newItem]);
    } else if (quickAddSection === 'discretionary') {
      handleAddCategory({
        name: label,
        limit: amount,
        icon: 'Tag',
        color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        textColor: 'text-amber-400'
      });
    } else if (quickAddSection === 'savings') {
      const newItem = {
        id: `savings_${Date.now()}`,
        label,
        amount,
        targetAmount: amount > 0 ? amount * 10 : 1000,
        currentAmount: 0,
        allocationPercent: 25
      };
      updateAndSyncSavingsGoals(prev => [...prev, newItem]);
    }

    setQuickAddName('');
    setQuickAddAmount('');
  };

  const updateAndSyncSavingsGoals = (
    newGoalsOrUpdater: { id: string; label: string; amount: number; targetAmount?: number; currentAmount?: number; allocationPercent?: number; isHidden?: boolean }[] | ((prev: { id: string; label: string; amount: number; targetAmount?: number; currentAmount?: number; allocationPercent?: number; isHidden?: boolean }[]) => { id: string; label: string; amount: number; targetAmount?: number; currentAmount?: number; allocationPercent?: number; isHidden?: boolean }[])
  ) => {
    setSavingsGoals(prev => {
      const nextGoals = typeof newGoalsOrUpdater === 'function' ? newGoalsOrUpdater(prev) : newGoalsOrUpdater;
      
      try {
        localStorage.setItem('expensetrack_savings_goals', JSON.stringify(nextGoals));
      } catch (e) {
        console.error('Error saving savings goals to local storage:', e);
      }

      const uid = currentUser?.uid || auth.currentUser?.uid;
      if (uid) {
        nextGoals.forEach(goal => {
          CloudDb.saveSavingsGoalToCloud(uid, goal).then(() => {
            SyncQueue.removePendingCreate('savings', goal.id);
          }).catch(console.error);
        });
      }

      return nextGoals;
    });
  };

  const handleUpdateIncomeStream = (id: string, updates: number | Partial<{ label: string; amount: number; isHidden?: boolean }>) => {
    setIncomeStreams(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          if (typeof updates === 'number') return { ...item, amount: updates };
          return { ...item, ...updates };
        }
        return item;
      });
      const uid = currentUser?.uid || auth.currentUser?.uid;
      if (uid) {
        const item = updated.find(i => i.id === id);
        if (item) CloudDb.saveIncomeStreamToCloud(uid, item).catch(console.error);
      }
      return updated;
    });
  };

  const refreshPlannerStatesFromStorage = () => {
    try {
      const incStr = localStorage.getItem('expensetrack_income_streams');
      if (incStr && JSON.parse(incStr).length > 0) {
        setIncomeStreams(JSON.parse(incStr));
      } else {
        localStorage.setItem('expensetrack_income_streams', JSON.stringify(DEFAULT_INCOME_STREAMS));
        setIncomeStreams(DEFAULT_INCOME_STREAMS);
      }

      const fixStr = localStorage.getItem('expensetrack_fixed_expenses');
      if (fixStr && JSON.parse(fixStr).length > 0) {
        setFixedExpenses(JSON.parse(fixStr));
      } else {
        localStorage.setItem('expensetrack_fixed_expenses', JSON.stringify(DEFAULT_FIXED_EXPENSES));
        setFixedExpenses(DEFAULT_FIXED_EXPENSES);
      }

      const savStr = localStorage.getItem('expensetrack_savings_goals');
      if (savStr && JSON.parse(savStr).length > 0) {
        setSavingsGoals(JSON.parse(savStr));
      } else {
        localStorage.setItem('expensetrack_savings_goals', JSON.stringify(DEFAULT_SAVINGS_GOALS));
        setSavingsGoals(DEFAULT_SAVINGS_GOALS);
      }
    } catch (e) {}
  };

  const handleDeleteIncomeStream = (id: string) => {
    setIncomeStreams(prev => prev.filter(item => item.id !== id));
    SyncQueue.removePendingCreate('income', id);
    SyncQueue.removePendingEdit('income', id);
    SyncQueue.addPendingDelete('income', id);
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (uid) {
      CloudDb.deleteIncomeStreamFromCloud(uid, id).catch(e => console.error(e));
    }
  };

  const handleAddIncomeStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeName.trim()) return;
    if (isDuplicateName(newIncomeName, 'income')) {
      setFormErrors(prev => ({ ...prev, income: `The name "${newIncomeName.trim()}" is already in use for another income source.` }));
      return;
    }
    const amount = parseFloat(newIncomeAmount) || 0;
    const newItem = {
      id: `income_${Date.now()}`,
      label: newIncomeName.trim(),
      amount
    };
    setIncomeStreams(prev => [...prev, newItem]);
    SyncQueue.addPendingCreate('income', newItem.id);
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (uid) {
      CloudDb.saveIncomeStreamToCloud(uid, newItem).then(() => {
        SyncQueue.removePendingCreate('income', newItem.id);
      }).catch(console.error);
    }
    setNewIncomeName('');
    setNewIncomeAmount('');
    setFormErrors(prev => ({ ...prev, income: null }));
  };

  const handleUpdateFixedExpense = (id: string, updates: number | Partial<{ label: string; amount: number; isHidden: boolean }>) => {
    setFixedExpenses(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          if (typeof updates === 'number') return { ...item, amount: updates };
          return { ...item, ...updates };
        }
        return item;
      });
      const uid = currentUser?.uid || auth.currentUser?.uid;
      if (uid) {
        const item = updated.find(i => i.id === id);
        if (item) CloudDb.saveFixedExpenseToCloud(uid, item).catch(console.error);
      }
      return updated;
    });
  };

  const handleUpdateSavingsGoal = (id: string, updates: number | Partial<{ label: string; amount: number; targetAmount?: number; currentAmount?: number; allocationPercent?: number; isHidden?: boolean }>) => {
    setSavingsGoalError(null);
    let errText = '';
    updateAndSyncSavingsGoals(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          if (typeof updates === 'number') {
            const cleanAmt = Math.round(((updates || 0) + Number.EPSILON) * 100) / 100;
            return { ...item, amount: cleanAmt };
          }

          let cleanUpdates = { ...updates };
          if (cleanUpdates.targetAmount !== undefined) {
            cleanUpdates.targetAmount = Math.round(((Number(cleanUpdates.targetAmount) || 0) + Number.EPSILON) * 100) / 100;
          }
          if (cleanUpdates.currentAmount !== undefined) {
            cleanUpdates.currentAmount = Math.round(((Number(cleanUpdates.currentAmount) || 0) + Number.EPSILON) * 100) / 100;
          }
          if (cleanUpdates.amount !== undefined) {
            cleanUpdates.amount = Math.round(((Number(cleanUpdates.amount) || 0) + Number.EPSILON) * 100) / 100;
          }

          if (typeof updates === 'object' && updates.isHidden === true && !item.isHidden) {
            const tgt = Math.round(((parseFloat(item.targetAmount as any) || 0) + Number.EPSILON) * 100) / 100;
            const cur = Math.max(
              Math.round(((parseFloat(item.currentAmount as any) || 0) + Number.EPSILON) * 100) / 100,
              Math.round(((parseFloat(item.amount as any) || 0) + Number.EPSILON) * 100) / 100
            );
            const alloc = parseFloat(item.allocationPercent as any) || 0;
            if (tgt > 0 || cur > 0 || alloc > 0) {
              const nonZeroFields: string[] = [];
              if (tgt > 0) nonZeroFields.push(`Target Amount (${currencySymbol}${tgt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
              if (cur > 0) nonZeroFields.push(`Amount Saved (${currencySymbol}${cur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
              if (alloc > 0) nonZeroFields.push(`Allocation % (${alloc}%)`);
              
              errText = `To hide "${item.label}", Target Amount, Amount Saved, and Allocation % must all be set to 0 first. (Currently non-zero: ${nonZeroFields.join(', ')})`;
              return item;
            }
          }
          return { ...item, ...cleanUpdates };
        }
        return item;
      });

      if (errText) {
        setSavingsGoalError(errText);
      }
      return updated;
    });
  };

  const handleAddFixedExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFixedName.trim()) return;
    if (newFixedName.toLowerCase().includes('savings')) {
      setFormErrors(prev => ({ ...prev, fixed: "Fixed expense names cannot contain the word 'savings' to prevent conflict." }));
      return;
    }
    if (isDuplicateName(newFixedName, 'fixed')) {
      setFormErrors(prev => ({ ...prev, fixed: `The name "${newFixedName.trim()}" is already in use for another fixed expense.` }));
      return;
    }
    const amount = parseFloat(newFixedAmount) || 0;
    const newItem = {
      id: `fixed_${Date.now()}`,
      label: newFixedName.trim(),
      amount
    };
    setFixedExpenses(prev => [...prev, newItem]);
    SyncQueue.addPendingCreate('fixed', newItem.id);
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (uid) {
      CloudDb.saveFixedExpenseToCloud(uid, newItem).then(() => {
        SyncQueue.removePendingCreate('fixed', newItem.id);
      }).catch(console.error);
    }
    setNewFixedName('');
    setNewFixedAmount('');
    setFormErrors(prev => ({ ...prev, fixed: null }));
  };

  const handleAddSavingsGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSavingsName.trim()) return;
    if (isDuplicateName(newSavingsName, 'savings')) {
      setFormErrors(prev => ({ ...prev, savings: `The name "${newSavingsName.trim()}" is already in use for another savings goal.` }));
      return;
    }
    const amount = Math.round(((parseFloat(newSavingsAmount) || 0) + Number.EPSILON) * 100) / 100;
    const targetAmount = Math.round(((parseFloat(newSavingsTarget) || 0) + Number.EPSILON) * 100) / 100;
    const currentAmount = 0;
    const allocationPercent = parseFloat(newSavingsPercent) || 0;

    if (allocationPercent <= 0) {
      setFormErrors(prev => ({ ...prev, savings: "A newly entered savings goal must have an allocation percentage greater than 0%." }));
      return;
    }
    let finalAlloc = allocationPercent;

    const newItem = {
      id: `savings_${Date.now()}`,
      label: newSavingsName.trim(),
      amount,
      targetAmount,
      currentAmount,
      allocationPercent: finalAlloc
    };
    SyncQueue.addPendingCreate('savings', newItem.id);
    updateAndSyncSavingsGoals(prev => [...prev, newItem]);
    setNewSavingsName('');
    setNewSavingsAmount('');
    setNewSavingsTarget('');
    setNewSavingsCurrent('');
    setNewSavingsPercent('');
    setFormErrors(prev => ({ ...prev, savings: null }));
  };

  const handleDeleteFixedExpense = (id: string) => {
    setFixedExpenses(prev => prev.filter(item => item.id !== id));
    SyncQueue.removePendingCreate('fixed', id);
    SyncQueue.removePendingEdit('fixed', id);
    SyncQueue.addPendingDelete('fixed', id);
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (uid) {
      CloudDb.deleteFixedExpenseFromCloud(uid, id).catch(e => console.error(e));
    }
  };

  const handleDeleteSavingsGoal = (id: string) => {
    SyncQueue.removePendingCreate('savings', id);
    SyncQueue.removePendingEdit('savings', id);
    SyncQueue.addPendingDelete('savings', id);
    const uid = currentUser?.uid || auth.currentUser?.uid;
    if (uid) {
      CloudDb.deleteSavingsGoalFromCloud(uid, id).catch(e => console.error(e));
    }
    updateAndSyncSavingsGoals(prev => prev.filter(item => item.id !== id));
  };

  const handleAddDiscretionaryCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscretionaryName.trim()) return;
    if (isDuplicateName(newDiscretionaryName, 'category')) {
      setFormErrors(prev => ({ ...prev, category: `The name "${newDiscretionaryName.trim()}" is already in use for another spending category.` }));
      return;
    }
    const limit = parseFloat(newDiscretionaryLimit) || 0;
    
    handleAddCategory({
      name: newDiscretionaryName.trim(),
      icon: 'Sparkles',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      textColor: 'text-emerald-400',
      limit: limit
    });
    
    setNewDiscretionaryName('');
    setNewDiscretionaryLimit('');
    setFormErrors(prev => ({ ...prev, category: null }));
  };

  // Feedback & Support states
  const [showGlobalMenu, setShowGlobalMenu] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // PWA Prompt State inside App.tsx
  const [pwaDeferredPrompt, setPwaDeferredPrompt] = useState<any>(null);
  const [pwaInstallable, setPwaInstallable] = useState<boolean>(false);
  const [showPwaGuide, setShowPwaGuide] = useState<boolean>(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Capacitor.isNativePlatform() ||
             window.matchMedia('(display-mode: standalone)').matches || 
             (navigator as any).standalone === true ||
             document.referrer.includes('android-app://');
    }
    return false;
  });

  const [lastBackupTime, setLastBackupTime] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('expensetrack_last_backup_time');
      if (stored) {
        const parsed = Number(stored);
        if (!isNaN(parsed)) return parsed;
      }
      // If not present, initialize it as current time (prevents prompt on first day)
      const now = Date.now();
      localStorage.setItem('expensetrack_last_backup_time', String(now));
      return now;
    } catch {
      return Date.now();
    }
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPwaDeferredPrompt(e);
      if (!isPwaInstalled) {
        setPwaInstallable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setPwaInstallable(false);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isPwaInstalled]);

  const triggerNativeInstall = async () => {
    if (!pwaDeferredPrompt) return;
    pwaDeferredPrompt.prompt();
    const { outcome } = await pwaDeferredPrompt.userChoice;
    console.log(`User responded to PWA install: ${outcome}`);
    setPwaDeferredPrompt(null);
    setPwaInstallable(false);
  };

  const triggerOpenInstallGuide = () => {
    setShowPwaGuide(true);
  };
  const [feedbackType, setFeedbackType] = useState<'bug' | 'enhancement'>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [feedbackSteps, setFeedbackSteps] = useState('');
  const [feedbackExpected, setFeedbackExpected] = useState('');

  const handleOpenFeedback = (type: 'bug' | 'enhancement') => {
    setFeedbackType(type);
    setFeedbackTitle('');
    setFeedbackDescription('');
    setFeedbackSteps('');
    setFeedbackExpected('');
    setShowFeedbackModal(true);
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackTitle.trim() || !feedbackDescription.trim()) return;

    const email = 'firstpayyourself@gmail.com';
    const subject = feedbackType === 'bug' 
      ? `[ExpenseTrack Bug Report] ${feedbackTitle}`
      : `[ExpenseTrack Feature Suggestion] ${feedbackTitle}`;

    const diagnosticInfo = `
-----------------------------------------
DIAGNOSTIC SYSTEM METADATA:
Device/User Agent: ${navigator.userAgent}
Screen Resolution: ${window.screen.width}x${window.screen.height}
App Version: 1.0.0 (Closed Beta Track)
Date: ${new Date().toLocaleString()}
-----------------------------------------
`;

    let body = `Hello Developer,\n\n`;
    if (feedbackType === 'bug') {
      body += `BUG DESCRIPTION:\n${feedbackDescription}\n\n`;
      if (feedbackSteps.trim()) {
        body += `STEPS TO REPRODUCE:\n${feedbackSteps}\n\n`;
      }
      if (feedbackExpected.trim()) {
        body += `EXPECTED RESULT vs ACTUAL RESULT:\n${feedbackExpected}\n\n`;
      }
    } else {
      body += `SUGGESTED ENHANCEMENT / ENHANCEMENT DETAILS:\n${feedbackDescription}\n\n`;
    }
    body += diagnosticInfo;

    // Open user's email client
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;

    // Reset fields & close
    setFeedbackTitle('');
    setFeedbackDescription('');
    setFeedbackSteps('');
    setFeedbackExpected('');
    setShowFeedbackModal(false);
  };

  // Developer mode managed via state from logo tap shortcut



  const handleCurrencyChange = (newSymbol: string) => {
    LocalDb.setCurrencySymbol(newSymbol);
    setCurrencySymbol(newSymbol);
  };

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const toggleCategoryFilter = (catId: string) => {
    setFilterCategories(prev => {
      if (prev.includes(catId)) {
        return prev.filter(id => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  // Close category dropdown popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset category filter when leaving the history screen
  useEffect(() => {
    if (activeTab !== 'history') {
      setFilterCategories([]);
      setIsCategoryFilterOpen(false);
    }
  }, [activeTab]);

  // Start/End date dropdown calendar states
  const [showStartDateCalendar, setShowStartDateCalendar] = useState<boolean>(false);
  const [startCalendarYear, setStartCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [startCalendarMonth, setStartCalendarMonth] = useState<number>(() => new Date().getMonth());

  const [showEndDateCalendar, setShowEndDateCalendar] = useState<boolean>(false);
  const [endCalendarYear, setEndCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [endCalendarMonth, setEndCalendarMonth] = useState<number>(() => new Date().getMonth());

  const startDateCalendarRef = useRef<HTMLDivElement | null>(null);
  const endDateCalendarRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll to top of main viewport container on tab screen transition
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Click Outside to close custom start calendar drop down
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (startDateCalendarRef.current && !startDateCalendarRef.current.contains(event.target as Node)) {
        setShowStartDateCalendar(false);
      }
    }
    if (showStartDateCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showStartDateCalendar]);

  // Click Outside to close custom end calendar drop down
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (endDateCalendarRef.current && !endDateCalendarRef.current.contains(event.target as Node)) {
        setShowEndDateCalendar(false);
      }
    }
    if (showEndDateCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEndDateCalendar]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-');
    let y = parseInt(year);
    let m = parseInt(month) - 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    const newMonth = `${y}-${m.toString().padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-');
    let y = parseInt(year);
    let m = parseInt(month) + 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
    const newMonth = `${y}-${m.toString().padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  // Trigger state refresh from Local Database
  const loadDatabaseState = (monthStr?: string) => {
    LocalDb.initialize();
    const activeMonth = monthStr || selectedMonth;
    
    setExpenses(LocalDb.getExpenses());
    setCategories(LocalDb.getCategories(activeMonth));
    setCurrentBudget(LocalDb.getBudgetForMonth(activeMonth));
    setDefaultCategoryIdState(LocalDb.getDefaultCategoryId());
    setCurrencySymbol(LocalDb.getCurrencySymbol());
  };



  // Run on initial mount and when month changes
  useEffect(() => {
    loadDatabaseState(selectedMonth);
  }, [selectedMonth]);

  // Subscribe to Firebase Authentication state changes & Realtime Cloud Sync
  useEffect(() => {
    let unsubRealtime: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (unsubRealtime) {
        unsubRealtime();
        unsubRealtime = null;
      }

      if (user) {
        // Initial download from cloud to local
        const hasCloudData = await CloudDb.downloadCloudDataToLocal(user.uid);
        
        // Only if cloud account is brand new / completely empty, upload local guest data to initialize cloud
        if (!hasCloudData) {
          await CloudDb.uploadLocalDataToCloud(user.uid);
        }

        loadDatabaseState(selectedMonth);
        refreshPlannerStatesFromStorage();

        // Subscribe to real-time changes across devices
        unsubRealtime = CloudDb.subscribeToCloudData(user.uid, () => {
          loadDatabaseState(selectedMonth);
          refreshPlannerStatesFromStorage();
        });
        unsubRealtimeRef.current = unsubRealtime;
      } else {
        LocalDb.clearAllData();
        loadDatabaseState(selectedMonth);
        refreshPlannerStatesFromStorage();
      }
    });

    const handleFocusOrVisible = async () => {
      if (auth.currentUser) {
        const downloaded = await CloudDb.downloadCloudDataToLocal(auth.currentUser.uid);
        if (downloaded) {
          loadDatabaseState(selectedMonth);
          refreshPlannerStatesFromStorage();
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      unsubscribeAuth();
      if (unsubRealtime) unsubRealtime();
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [selectedMonth]);

  // Sync total budget target in standard MonthlyBudgets system when category limits sum changes
  const totalCalculatedLimit = useMemo(() => {
    return categories.filter(c => c.id !== 'cat_business_expense').reduce((sum, c) => sum + (c.limit || 0), 0);
  }, [categories]);

  useEffect(() => {
    if (currentBudget.month && currentBudget.limitAmount !== undefined && totalCalculatedLimit !== currentBudget.limitAmount) {
      handleUpdateBudget(totalCalculatedLimit, currentBudget.categoryLimits || {});
    }
  }, [totalCalculatedLimit, currentBudget.month, currentBudget.limitAmount]);



  // Action Handlers
  const handleDefaultCategoryChange = (id: string) => {
    LocalDb.setDefaultCategoryId(id);
    setDefaultCategoryIdState(id);
  };
  const handleAddExpense = (newExpenseData: Omit<Expense, 'id' | 'createdAt'>) => {
    LocalDb.addExpense(newExpenseData);
    if (newExpenseData.category.startsWith('SAVINGS_')) {
      const goalId = newExpenseData.category.substring(8);
      updateAndSyncSavingsGoals(prev => prev.map(goal => {
        if (goal.id === goalId) {
          const updatedAmount = Math.round((((goal.currentAmount || 0) - newExpenseData.amount) + Number.EPSILON) * 100) / 100;
          return { ...goal, currentAmount: updatedAmount };
        }
        return goal;
      }));
    }
    const dateMonth = newExpenseData.date.substring(0, 7); // Get "YYYY-MM"
    if (dateMonth !== selectedMonth) {
      setSelectedMonth(dateMonth);
    } else {
      loadDatabaseState(selectedMonth);
    }
    setShowAddForm(false);
  };

  // Process raw payment notification text (from Native Android, Webhook polling, or manual simulator/paste)
  const handleProcessNotification = (
    rawText: string,
    sourceHint?: WalletSource,
    remoteItem?: any
  ) => {
    const parsed = parseNotificationText(rawText, sourceHint);
    if (!parsed) {
      console.warn('Could not parse transaction notification:', rawText);
      return;
    }

    // 1. Smart 5-Minute Deduplication Check (e.g. Google Wallet + Bank SMS both firing)
    const dupCheck = TransactionDeduplicator.checkDuplicate(parsed.amount, parsed.vendor, parsed.source);
    if (dupCheck.isDuplicate) {
      console.log('Deduplication hit:', dupCheck.reason);
      
      // Acknowledge remote item if it came from server queue
      if (remoteItem?.id) {
        fetch('/api/notifications/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: remoteItem.id })
        }).catch(() => {});
      }

      // Log in audit trail as duplicate
      LocalDb.saveDetectedNotification({
        id: `notif_dup_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        rawText,
        vendor: parsed.vendor,
        amount: parsed.amount,
        currency: parsed.currency || currencySymbol,
        date: parsed.date || new Date().toISOString().split('T')[0],
        source: parsed.source,
        appName: parsed.appName,
        status: 'ignored',
        assignedCategoryId: 'duplicate',
        detectedAt: Date.now()
      });

      // Show deduplication toast notification
      setAutoPostToast({
        message: `🛡️ Duplicate Filtered: ${parsed.vendor} (${currencySymbol}${parsed.amount.toFixed(2)}) was already captured ${dupCheck.timeDiffSeconds}s ago via ${dupCheck.matchedTransaction?.source || 'another alert'}.`,
        vendor: parsed.vendor,
        amount: parsed.amount,
        categoryName: 'Duplicate Shield',
        expenseId: 'duplicate'
      });

      setTimeout(() => {
        setAutoPostToast(prev => prev?.expenseId === 'duplicate' ? null : prev);
      }, 6000);

      return;
    }

    // Check if we already have a vendor rule configured
    const existingRule = LocalDb.findVendorRule(parsed.vendor);

    if (existingRule && existingRule.autoPost) {
      // Rule exists AND auto-post is enabled: directly log expense!
      const targetCat = categories.find(c => c.id === existingRule.categoryId) || categories[0];
      const targetCatName = targetCat ? targetCat.name : 'Category';
      const expenseDate = parsed.date || new Date().toISOString().split('T')[0];

      const newExpenseData: Omit<Expense, 'id' | 'createdAt'> = {
        amount: parsed.amount,
        category: existingRule.categoryId,
        date: expenseDate,
        note: `${existingRule.displayName} (${parsed.appName || 'Wallet Sync'})`,
        paymentMethod: 'digital_wallet'
      };

      const added = LocalDb.addExpense(newExpenseData);
      LocalDb.recordVendorUsage(existingRule.displayName, parsed.amount);

      // Record in deduplicator fingerprint cache
      TransactionDeduplicator.recordTransaction({
        amount: parsed.amount,
        currency: parsed.currency || currencySymbol,
        vendor: existingRule.displayName,
        source: parsed.source,
        expenseId: added.id,
        rawText
      });

      LocalDb.saveDetectedNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        rawText,
        vendor: existingRule.displayName,
        amount: parsed.amount,
        currency: parsed.currency || currencySymbol,
        date: expenseDate,
        source: parsed.source,
        appName: parsed.appName,
        status: 'auto_posted',
        assignedCategoryId: existingRule.categoryId,
        detectedAt: Date.now(),
        expenseId: added.id
      });

      // Acknowledge remote item if it came from server queue
      if (remoteItem?.id) {
        fetch('/api/notifications/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: remoteItem.id })
        }).catch(() => {});
      }

      loadDatabaseState(selectedMonth);

      // Show auto-post toast with instant Undo action
      setAutoPostToast({
        message: `⚡ Auto-Posted ${currencySymbol}${parsed.amount.toFixed(2)} at ${existingRule.displayName} to ${targetCatName}`,
        vendor: existingRule.displayName,
        amount: parsed.amount,
        categoryName: targetCatName,
        expenseId: added.id
      });

      setTimeout(() => {
        setAutoPostToast(prev => prev?.expenseId === added.id ? null : prev);
      }, 7000);
    } else {
      // First time vendor OR autoPost was disabled by user: Prompt user to set category & auto-post choice
      const suggestedCategory = existingRule 
        ? existingRule.categoryId 
        : suggestCategoryForVendor(parsed.vendor, categories);

      setFirstTimeVendorData({
        vendorName: existingRule?.displayName || parsed.vendor,
        amount: parsed.amount,
        currencySymbol: parsed.currency || currencySymbol,
        source: parsed.source,
        appName: parsed.appName,
        date: parsed.date,
        suggestedCategoryId: suggestedCategory,
        rawText,
        notifId: remoteItem?.id
      });
    }
  };

  const handleConfirmFirstTimeVendor = (data: {
    vendorName: string;
    categoryId: string;
    autoPost: boolean;
    amount: number;
  }) => {
    if (!firstTimeVendorData) return;

    // 1. Save vendor rule for future transactions
    LocalDb.saveVendorRule({
      vendorPattern: data.vendorName.toLowerCase().trim(),
      displayName: data.vendorName.trim(),
      categoryId: data.categoryId,
      autoPost: data.autoPost,
      lastAmount: data.amount
    });

    // 2. Add the expense to database
    const targetCat = categories.find(c => c.id === data.categoryId);
    const targetCatName = targetCat ? targetCat.name : 'Category';
    const expenseDate = firstTimeVendorData.date || new Date().toISOString().split('T')[0];

    const newExpenseData: Omit<Expense, 'id' | 'createdAt'> = {
      amount: data.amount,
      category: data.categoryId,
      date: expenseDate,
      note: `${data.vendorName} (${firstTimeVendorData.appName || 'Wallet Sync'})`,
      paymentMethod: 'digital_wallet'
    };

    const added = LocalDb.addExpense(newExpenseData);
    LocalDb.recordVendorUsage(data.vendorName, data.amount);

    // Record in deduplicator fingerprint cache
    TransactionDeduplicator.recordTransaction({
      amount: data.amount,
      currency: currencySymbol,
      vendor: data.vendorName,
      source: firstTimeVendorData.source,
      expenseId: added.id,
      rawText: firstTimeVendorData.rawText
    });

    LocalDb.saveDetectedNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      rawText: firstTimeVendorData.rawText,
      vendor: data.vendorName,
      amount: data.amount,
      currency: currencySymbol,
      date: expenseDate,
      source: firstTimeVendorData.source,
      appName: firstTimeVendorData.appName,
      status: 'manually_approved',
      assignedCategoryId: data.categoryId,
      detectedAt: Date.now(),
      expenseId: added.id
    });

    // 3. Acknowledge server queue if applicable
    if (firstTimeVendorData.notifId) {
      fetch('/api/notifications/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: firstTimeVendorData.notifId })
      }).catch(() => {});
    }

    setFirstTimeVendorData(null);
    loadDatabaseState(selectedMonth);

    // Toast notification
    setAutoPostToast({
      message: `Recorded ${currencySymbol}${data.amount.toFixed(2)} at ${data.vendorName} • Future auto-post: ${data.autoPost ? 'Active' : 'Off'}`,
      vendor: data.vendorName,
      amount: data.amount,
      categoryName: targetCatName,
      expenseId: added.id
    });

    setTimeout(() => {
      setAutoPostToast(null);
    }, 5000);
  };

  const handleUndoAutoPost = (expenseId: string) => {
    LocalDb.deleteExpense(expenseId);
    setAutoPostToast(null);
    loadDatabaseState(selectedMonth);
  };

  // Webhook Polling for incoming payment notifications
  useEffect(() => {
    const syncSettings = LocalDb.getWalletSyncSettings();
    if (!syncSettings.enabled) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = syncSettings.webhookToken;
        const res = await fetch(`/api/notifications/pending?token=${encodeURIComponent(token)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.notifications) && data.notifications.length > 0) {
          for (const item of data.notifications) {
            handleProcessNotification(
              item.rawText || `${item.vendor} ${item.amount}`,
              item.source as WalletSource,
              item
            );
          }
        }
      } catch (e) {
        // Suppress network errors during offline or transient failures
      }
    }, 8000);

    return () => clearInterval(pollInterval);
  }, [categories, selectedMonth, currencySymbol]);

  // Native Android Background Transaction Notification Listener (Capacitor APK)
  useEffect(() => {
    if (!NativeWalletBridge.isNativeAndroid()) return;

    // 1. Fetch any transactions caught in background while app was closed or asleep
    NativeWalletBridge.fetchPendingNativeTransactions().then(pending => {
      if (pending && pending.length > 0) {
        for (const tx of pending) {
          handleProcessNotification(
            tx.rawText || `${tx.vendor} ${tx.amount}`,
            tx.source,
            { id: tx.id }
          );
        }
      }
    }).catch(() => {});

    // 2. Subscribe to real-time events while app is open
    const unsubNative = NativeWalletBridge.subscribe(tx => {
      handleProcessNotification(
        tx.rawText || `${tx.vendor} ${tx.amount}`,
        tx.source,
        { id: tx.id }
      );
    });

    return () => {
      unsubNative();
    };
  }, [categories, selectedMonth, currencySymbol]);

  const handleSaveEditedExpense = (updatedData: Omit<Expense, 'id' | 'createdAt'>) => {
    if (editingExpense) {
      const prevExpense = editingExpense;
      const fullUpdatedExpense: Expense = {
        ...editingExpense,
        ...updatedData
      };

      // Revert previous expense if it was a savings category (add back the money)
      let goalsUpdated = false;
      let newGoals = [...savingsGoals];

      if (prevExpense.category.startsWith('SAVINGS_')) {
        const prevGoalId = prevExpense.category.substring(8);
        newGoals = newGoals.map(goal => {
          if (goal.id === prevGoalId) {
            goalsUpdated = true;
            return { ...goal, currentAmount: Math.round((((goal.currentAmount || 0) + prevExpense.amount) + Number.EPSILON) * 100) / 100 };
          }
          return goal;
        });
      }

      // Apply new expense if it is a savings category (deduct the money)
      if (updatedData.category.startsWith('SAVINGS_')) {
        const newGoalId = updatedData.category.substring(8);
        newGoals = newGoals.map(goal => {
          if (goal.id === newGoalId) {
            goalsUpdated = true;
            const updatedAmount = Math.round((((goal.currentAmount || 0) - updatedData.amount) + Number.EPSILON) * 100) / 100;
            return { ...goal, currentAmount: updatedAmount };
          }
          return goal;
        });
      }

      if (goalsUpdated) {
        updateAndSyncSavingsGoals(newGoals);
      }

      LocalDb.updateExpense(fullUpdatedExpense);
      const dateMonth = updatedData.date.substring(0, 7); // Get "YYYY-MM"
      if (dateMonth !== selectedMonth) {
        setSelectedMonth(dateMonth);
      } else {
        loadDatabaseState(selectedMonth);
      }
      setEditingExpense(null);
    }
  };

  const handleDeleteExpense = (id: string) => {
    // Revert savings goal if it was a SAVINGS category
    const expenseToDeleteObj = expenses.find(e => e.id === id);
    if (expenseToDeleteObj && expenseToDeleteObj.category.startsWith('SAVINGS_')) {
      const goalId = expenseToDeleteObj.category.substring(8);
      updateAndSyncSavingsGoals(prev => prev.map(goal => {
        if (goal.id === goalId) {
          return { ...goal, currentAmount: Math.round((((goal.currentAmount || 0) + expenseToDeleteObj.amount) + Number.EPSILON) * 100) / 100 };
        }
        return goal;
      }));
    }

    LocalDb.deleteExpense(id);
    loadDatabaseState(selectedMonth);
    setExpenseToDelete(null);
  };

  const handleExportToCSV = () => {
    if (filteredExpenses.length === 0) {
      alert("No expenses matching current filters to export.");
      return;
    }

    const headers = ["Date", "Note", "Category", "Payment Method", "Amount"];
    const rows = filteredExpenses.map(exp => {
      const cat = categories.find(c => c.id === exp.category);
      const categoryName = cat ? cat.name : "Uncategorized";
      const paymentMethod = exp.paymentMethod === 'card' ? 'Card' : exp.paymentMethod === 'digital_wallet' ? 'Wallet' : exp.paymentMethod === 'cash' ? 'Cash' : 'Other';
      return [
        exp.date,
        exp.note,
        categoryName,
        paymentMethod,
        exp.amount
      ];
    });

    // Add total row at the bottom of CSV
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    rows.push(["", "", "", "", ""]);
    rows.push(["Total", "", "", "", `${currencySymbol}${totalAmount.toFixed(2)}`]);

    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().substring(0, 10);
    link.setAttribute("download", `expensetrack_expenses_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportToPDF = () => {
    if (filteredExpenses.length === 0) {
      alert("No expenses matching current filters to export.");
      return;
    }

    const doc = new jsPDF();

    // 1. Header Letterhead Style Custom Branding
    doc.setFillColor(15, 118, 110); // #0F766E
    doc.roundedRect(14, 14, 8, 8, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text("E", 16.5, 19.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 118, 110);
    doc.text("LOOSEBUDGET STATEMENT", 25, 19);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Business Expense Ledger", 14, 31);

    // Underline divider
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.5);
    doc.line(14, 36, 196, 36);

    // 2. Info Grid Meta Blocks (Left Aligned Statement Period)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("STATEMENT PERIOD", 14, 43);

    const [yearPart, monthPart] = selectedMonth.split('-');
    const mDate = new Date(parseInt(yearPart), parseInt(monthPart) - 1, 1);
    const mName = mDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    let periodText = mName;
    if (filterStartDate || filterEndDate) {
      const formatStringDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          return new Date(y, m, d).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
        }
        return dateStr;
      };

      if (filterStartDate && filterEndDate) {
        periodText = `${formatStringDate(filterStartDate)} - ${formatStringDate(filterEndDate)}`;
      } else if (filterStartDate) {
        periodText = `From ${formatStringDate(filterStartDate)}`;
      } else if (filterEndDate) {
        periodText = `Through ${formatStringDate(filterEndDate)}`;
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(periodText, 14, 48);

    const todayStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Date Mapped: ${todayStr}`, 14, 52);

    // 3. Stats Block KPIs - shifting card Y up because the info grid only takes 52 max (saving 8px)
    const totalSpent = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Card 1: Total Ledger
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, 58, 56, 14, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL LEDGER", 17, 63);

    doc.setFont("courier", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`${currencySymbol}${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 17, 69);

    // Card 2: Transactions count
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(74, 58, 56, 14, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("TRANSACTIONS COUNT", 77, 63);

    doc.setFont("courier", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${filteredExpenses.length} Items`, 77, 69);

    // Card 3: Deductible Rate Tag
    doc.setFillColor(240, 253, 250); // teal-50
    doc.setDrawColor(204, 251, 241); // teal-100
    doc.roundedRect(134, 58, 62, 14, 1, 1, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text("DEDUCTIBLE RATE", 137, 63);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 118, 110); // teal-800
    doc.text("100% Taxable", 137, 69);

    let y = 84;

    // Header values
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y - 5, 182, 8, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    doc.text("Date", 16, y);
    doc.text("Merchant Name / details", 38, y);
    doc.text("Category", 110, y);
    doc.text("Method", 152, y);
    doc.text("Amount", 172, y);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, y + 4, 196, y + 4);

    y += 10;

    // Table rows
    const sorted = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sorted.forEach((exp, idx) => {
      if (y > 265) {
        doc.addPage();
        y = 25;

        doc.setFillColor(241, 245, 249);
        doc.roundedRect(14, y - 5, 182, 8, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        doc.text("Date", 16, y);
        doc.text("Merchant Name / details", 38, y);
        doc.text("Category", 110, y);
        doc.text("Method", 152, y);
        doc.text("Amount", 172, y);

        doc.setDrawColor(203, 213, 225);
        doc.line(14, y + 4, 196, y + 4);

        y += 10;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, 182, 6.5, "F");
      }

      const cat = categories.find(c => c.id === exp.category);
      const catName = cat ? cat.name : "Uncategorized";
      const payment = exp.paymentMethod === 'card' ? 'CARD' : exp.paymentMethod === 'digital_wallet' ? 'WALLET' : exp.paymentMethod === 'cash' ? 'CASH' : 'OTHER';

      let displayNote = exp.note;
      if (displayNote.length > 38) {
        displayNote = displayNote.substring(0, 35) + "...";
      }

      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(exp.date, 16, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(displayNote, 38, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(catName.toUpperCase(), 110, y);

      doc.setFont("helvetica", "medium");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(payment, 152, y);

      const amtVal = `${currencySymbol}${exp.amount.toFixed(2)}`;
      doc.setFont("courier", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(amtVal, 172, y);

      // Slate divider line
      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 3, 196, y + 3);

      y += 7.5;
    });

    // Add a Total row to the end of the PDF table
    if (y > 265) {
      doc.addPage();
      y = 25;
    }
    
    // Draw table bottom border line
    doc.setDrawColor(15, 118, 110); // primary teal color
    doc.setLineWidth(0.5);
    doc.line(14, y - 2, 196, y - 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("TOTAL EXPENSES", 16, y + 3);

    const totalAmtText = `${currencySymbol}${totalSpent.toFixed(2)}`;
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(totalAmtText, 172, y + 3);

    // Double underline under the total
    doc.line(14, y + 7, 196, y + 7);
    doc.line(14, y + 8, 196, y + 8);
    
    y += 12;

    // 4. Audit Footer Box & Check Signature
    if (y > 245) {
      doc.addPage();
      y = 25;
    }

    y += 3;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.roundedRect(14, y, 182, 16, 1, 1, "FD");

    // Right side blank signature line with no text
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(145, y + 10, 185, y + 10);

    const fileDate = new Date().toISOString().substring(0, 10);
    doc.save(`expensetrack_report_${fileDate}.pdf`);
  };

  const handleUpdateBudget = (limit: number, limits: Record<string, number>) => {
    LocalDb.setBudget(selectedMonth, limit, limits);
    loadDatabaseState(selectedMonth);
  };

  const handleResetDatabase = async () => {
    // Capture active subscription state so paid account access / renewal status is preserved
    const savedSubState = SubscriptionManager.getSubscriptionState();

    // Clear LocalStorage and SessionStorage (local cache only)
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch (e) {}

    // Restore subscription state locally and to cloud profile
    if (savedSubState) {
      try {
        SubscriptionManager.saveSubscriptionState(savedSubState);
      } catch (e) {}
    }

    // Purge IndexedDB databases (local app offline cache)
    try {
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name) {
            window.indexedDB.deleteDatabase(dbInfo.name);
          }
        }
      }
    } catch (e) {}

    // Unregister service workers to clear PWA application cache
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let reg of registrations) {
          await reg.unregister();
        }
      }
    } catch (e) {}

    // Purge browser Cache Storage
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
      }
    } catch (e) {}

    // Reset local database structures to fresh empty state
    try {
      LocalDb.resetToFreshInstall();
    } catch (e) {}

    // Hard reload to initialize pristine fresh state
    window.location.reload();
  };

  const handleWipeCloudDatabase = async () => {
    try {
      setDevNotice('🔄 Wiping Cloud & Local Database...');

      // 1. Unsubscribe active real-time Firestore listeners to prevent auto re-upload loop
      if (unsubRealtimeRef.current) {
        try {
          unsubRealtimeRef.current();
        } catch (e) {}
        unsubRealtimeRef.current = null;
      }

      // 2. Wipe all collections in Firestore for this user + local database
      if (currentUser?.uid) {
        await CloudDb.wipeUserCloudData(currentUser.uid);
      } else {
        LocalDb.clearAllData();
      }

      setDevNotice('✨ Database Wiped Successfully!');

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Error wiping cloud DB:', err);
      setDevNotice('❌ Failed to wipe database');
      setTimeout(() => setDevNotice(null), 3500);
    }
  };

  const handleLoadDemoData = () => {
    LocalDb.resetToDemoData();
    loadDatabaseState(selectedMonth);
    setActiveTab('dashboard');
  };

  const handleAddCategory = (catData: Omit<Category, 'id'>, isDefault?: boolean): boolean => {
    if (catData.name.toLowerCase().includes('savings')) {
      alert("Spending category names cannot contain the word 'savings' to prevent conflict with Savings Goal categories.");
      return false;
    }
    if (isDuplicateName(catData.name, 'category')) {
      alert(`The name "${catData.name.trim()}" is already in use in another section or category. Please choose a unique name.`);
      return false;
    }
    const created = LocalDb.addCategory(catData, selectedMonth);
    if (isDefault) {
      LocalDb.setDefaultCategoryId(created.id);
    }
    loadDatabaseState(selectedMonth);
    return true;
  };

  const handleUpdateCategory = (cat: Category, isDefault?: boolean): boolean => {
    if (cat.name.toLowerCase().includes('savings')) {
      alert("Spending category names cannot contain the word 'savings' to prevent conflict with Savings Goal categories.");
      return false;
    }
    if (isDuplicateName(cat.name, 'category', cat.id)) {
      alert(`The name "${cat.name.trim()}" is already in use in another section or category. Please choose a unique name.`);
      return false;
    }
    LocalDb.updateCategory(cat, selectedMonth);
    if (isDefault) {
      LocalDb.setDefaultCategoryId(cat.id);
    }
    loadDatabaseState(selectedMonth);
    return true;
  };

  const handleDeleteCategory = (id: string) => {
    LocalDb.deleteCategory(id);
    loadDatabaseState(selectedMonth);
  };

  // Helper values checking budget progress
  const totals = useMemo(() => {
    const currentMonthPrefix = selectedMonth; // use selectedMonth prefix
    
    // Filter expenses in the current month to show true budgeting outcomes, excluding Business Expense and Savings expenses completely from any computations
    const currentMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonthPrefix) && e.category !== 'cat_business_expense' && !e.category.startsWith('SAVINGS_'));
    const totalSpent = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // The Total Budget limit should be the total of active (non-hidden) individual category budgets (excluding business and savings expenses)
    const limit = categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_') && !c.isHidden).reduce((sum, c) => sum + (c.limit || 0), 0);
    
    const percent = limit > 0 
      ? Math.round((totalSpent / limit) * 100) 
      : (totalSpent > 0 ? 100 : 0);
    const remaining = limit - totalSpent;
 
    // Parse month name elegantly
    const [yearPart, monthPart] = selectedMonth.split('-');
    const parsedDate = new Date(parseInt(yearPart), parseInt(monthPart) - 1, 15);
    const monthName = parsedDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
 
    return {
      totalSpent,
      percent,
      remaining,
      limit,
      currentMonthExpenses,
      monthName
    };
  }, [expenses, categories, selectedMonth]);

  const showBackupReminder = useMemo(() => {
    // If user is signed in to Cloud Sync, cloud automatically backs up data real-time
    if (currentUser) return false;
    // Only remind if the user has transactions to back up
    if (expenses.length === 0) return false;
    
    const diffTime = Date.now() - lastBackupTime;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  }, [currentUser, expenses, lastBackupTime]);
 
  // Derived category statistics for insights
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; color: string; label: string; limit: number }> = {};
    
    // Initialize stats and exclude Business Expense and Savings from budget stats report
    categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_')).forEach(c => {
      stats[c.id] = { total: 0, count: 0, color: c.color, label: c.name, limit: c.limit || 0 };
    });

    // Populate stats
    totals.currentMonthExpenses.forEach(e => {
      if (!stats[e.category]) {
        // Fallback for custom or deleted categories
        stats[e.category] = { total: 0, count: 0, color: 'bg-gray-100 text-gray-800', label: 'Uncategorized', limit: 0 };
      }
      stats[e.category].total += e.amount;
      stats[e.category].count += 1;
    });

    return Object.entries(stats)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [categories, totals.currentMonthExpenses]);

  // Recharts Chart Data Calculations
  const trendChartData = useMemo(() => {
    const [yearPart, monthPart] = selectedMonth.split('-');
    const currentYear = parseInt(yearPart);
    const currentMonth = parseInt(monthPart); // 1-indexed

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Create daily slots container
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateString = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
      return {
        day: dayNum,
        dateString,
        dailySpend: 0,
        cumulativeSpend: 0
      };
    });

    // Bucket expenses into dailySpend
    totals.currentMonthExpenses.forEach(e => {
      if (!e.date) return;
      const parts = e.date.split('-');
      let dayPart = NaN;
      if (parts.length >= 3) {
        dayPart = parseInt(parts[2], 10);
      } else {
        // Fallback: try slash splitting or standard JS Date parsing
        const slashParts = e.date.split('/');
        if (slashParts.length >= 3) {
          dayPart = parseInt(slashParts[2], 10);
        } else {
          const parsedDate = new Date(e.date);
          if (!isNaN(parsedDate.getTime())) {
            dayPart = parsedDate.getUTCDate();
          }
        }
      }

      if (!isNaN(dayPart) && dayPart >= 1 && dayPart <= daysInMonth) {
        days[dayPart - 1].dailySpend += e.amount;
      }
    });

    // Accumulate sum over days
    let cumulative = 0;
    const finalData = days.map(d => {
      cumulative += d.dailySpend;
      return {
        ...d,
        cumulativeSpend: Math.round(cumulative * 100) / 100,
        dailySpend: Math.round(d.dailySpend * 100) / 100
      };
    });

    // Filter out future days ONLY if the selectedMonth is the current live actual month
    const todayStr = getLocalMonthString();
    if (selectedMonth === todayStr) {
      const todayDay = new Date().getDate();
      return finalData.filter(d => d.day <= todayDay);
    }
    return finalData;
  }, [totals.currentMonthExpenses, selectedMonth]);

  // Recharts custom label for category breakdowns
  const categoryPieData = useMemo(() => {
    return categoryStats.map(s => ({
      id: s.id,
      name: s.label,
      value: Math.round(s.total * 100) / 100,
      color: resolveColorHex(s.color)
    }));
  }, [categoryStats]);

  // Search and filtered expenses for list rendering
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = searchQuery === '' || 
        (e.note && e.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (categories.find(c => c.id === e.category)?.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = filterCategories.length === 0 || filterCategories.includes(e.category);
      const matchesPayment = filterPayment === 'all' || e.paymentMethod === filterPayment;

      const hasCustomDateRange = !!(filterStartDate || filterEndDate);
      const matchesMonth = hasCustomDateRange || e.date.substring(0, 7) === selectedMonth;

      const matchesStartDate = !filterStartDate || e.date >= filterStartDate;
      const matchesEndDate = !filterEndDate || e.date <= filterEndDate;

      return matchesSearch && matchesCategory && matchesPayment && matchesMonth && matchesStartDate && matchesEndDate;
    });
  }, [expenses, searchQuery, filterCategories, filterPayment, filterStartDate, filterEndDate, selectedMonth, categories]);

  // Dynamic status details
  const statusConfig = useMemo(() => {
    // Determine the percentage of the month that has passed
    let percentOfMonthPassed = 100;
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1; // 1-indexed

    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    if (year > todayYear || (year === todayYear && month > todayMonth)) {
      percentOfMonthPassed = 0;
    } else if (year === todayYear && month === todayMonth) {
      const currentDay = today.getDate();
      const totalDays = new Date(year, month, 0).getDate();
      percentOfMonthPassed = (currentDay / totalDays) * 100;
    } else {
      percentOfMonthPassed = 100;
    }

    const isSpendingTooFast = totals.percent >= (percentOfMonthPassed + 10);

    if (totals.percent >= 100) {
      return {
        title: "Over Budget Limit!",
        desc: totals.limit === 0 
          ? "No budget limits set, but expenses exist. Create a budget to stay on track." 
          : "Daily spending expenses have exceeded set goals. Limit your expenditures immediately.",
        color: "text-rose-400 border-rose-500/20 bg-rose-500/5",
        pillColor: "bg-rose-500 text-white",
        ringColor: "border-rose-500"
      };
    } else if (totals.percent >= 80) {
      return {
        title: "Approaching Limit",
        desc: "You have used more than 80% of daily spending limits. Control optional purchases.",
        color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
        pillColor: "bg-amber-500 text-white",
        ringColor: "border-amber-500"
      };
    } else if (isSpendingTooFast) {
      return {
        title: "Warning: Spending Too Fast",
        desc: `Your spending (${totals.percent}%) is pacing significantly ahead of the month (${Math.round(percentOfMonthPassed)}% passed). Slow down to stay on track.`,
        color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
        pillColor: "bg-yellow-500 text-black font-bold",
        ringColor: "border-yellow-500"
      };
    } else {
      return {
        title: "Looking Good",
        desc: "Total spending is within your target",
        color: "text-green-400 border-green-500/20 bg-green-500/5",
        pillColor: "bg-green-500 text-white",
        ringColor: "border-green-500"
      };
    }
  }, [totals.percent, selectedMonth]);

  const showAds = showSimulatedAds && expenses.length > 0 && activeTab !== 'help' && (activeTab as string) !== 'budget' && activeTab !== 'budget_plan';

  return (
    <AndroidFrame 
      currentTime="01:15" 
      onRefreshDatabase={handleResetDatabase}
    >
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden select-none relative" id="android_app_root">
        {/* App Title & Top Header */}
        <div className="bg-[#0A0A0A] text-white pt-[calc(10px+env(safe-area-inset-top,0px))] pb-2 px-2.5 sm:px-3.5 flex items-center justify-between shrink-0 border-b border-white/5 relative">
          <div 
            onClick={handleLogoTap}
            className="flex items-center gap-2 select-none pr-1 sm:pr-4 shrink-0 cursor-pointer active:opacity-80 transition-opacity"
            title="LooseBudget Logo"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden border border-emerald-500/20 flex items-center justify-center bg-black shrink-0 relative shadow-md shadow-emerald-950/20 active:scale-90 transition-transform">
              <img 
                src={appLogo} 
                alt="LooseBudget Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-xs sm:text-sm font-extrabold tracking-tight uppercase tracking-widest text-[#eeeeee]">Loose<span className="text-emerald-400">Budget</span></h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 relative z-50 shrink-0">
            {/* Membership / Trial Status Badge */}
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="px-2 py-1 text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 active:scale-95 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
              title="View Membership & Subscription Details"
            >
              <Sparkles size={12} className="text-amber-300 shrink-0" />
              <span className="font-sans">
                {subscriptionState.isSubscribed ? (
                  'PRO'
                ) : SubscriptionManager.getTrialHoursRemaining(subscriptionState) > 0 ? (
                  <>
                    <span className="sm:hidden">Preview ({SubscriptionManager.getTrialTimeRemainingText(subscriptionState)})</span>
                    <span className="hidden sm:inline">2-Day Preview ({SubscriptionManager.getTrialTimeRemainingText(subscriptionState)} left)</span>
                  </>
                ) : (
                  'Demo Mode'
                )}
              </span>
            </button>

            {/* Firebase Cloud Sync Button */}
            {/* Cloud Sync Status/Trigger Button (Hidden in Demo Mode) */}
            {!isDemoMode && (
              <button
                onClick={() => {
                  setShowAuthModal(true);
                }}
                className={`px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] font-bold border rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 ${
                  currentUser
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
                }`}
                title={
                  currentUser
                    ? `Signed in as ${currentUser.displayName || currentUser.email || 'Cloud User'}`
                    : 'Sign in for Firebase Cloud Sync'
                }
              >
                <Cloud size={13} className={currentUser ? 'text-emerald-400 animate-pulse shrink-0' : 'text-gray-400 shrink-0'} />
                <span className="hidden sm:inline font-sans">
                  {currentUser ? 'Cloud Synced' : 'Cloud Sync'}
                </span>
              </button>
            )}

            {/* Direct PWA Install or Guide Trigger (Hidden in Demo Mode) */}
            {!isDemoMode && !isPwaInstalled && (
              pwaInstallable ? (
                <button
                  onClick={triggerNativeInstall}
                  className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-black active:scale-95 rounded-xl transition-all flex items-center gap-1 animate-pulse cursor-pointer border-0 shadow-md shadow-emerald-950/40 shrink-0"
                  title="Install LooseBudget on your device as a native standalone application"
                >
                  <Download size={12} className="stroke-[3] shrink-0" />
                  <span>Install 📲</span>
                </button>
              ) : (
                <button
                  onClick={triggerOpenInstallGuide}
                  className="px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] font-bold bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/15 active:scale-95 rounded-xl transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title="View instructions to install this PWA app on iPhone, iPad, Android or Desktop"
                >
                  <Download size={12} className="text-emerald-400 shrink-0" />
                  <span>Install 📲</span>
                </button>
              )
            )}

            {/* Click backdrop overlay to close the dropdown easily */}
            {showGlobalMenu && (
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setShowGlobalMenu(false)}
              />
            )}

            <button
              onClick={() => setShowGlobalMenu(prev => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center relative z-50 active:scale-95 border-0 bg-transparent ${
                showGlobalMenu 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              title="Open Navigation Menu"
            >
              <Menu size={18} className="stroke-[2.5]" />
            </button>

            {/* Floating Dropdown Menu Container */}
            {showGlobalMenu && (
              <div className="absolute top-full right-0 mt-2.5 w-56 bg-[#111111] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1.5 border-b border-white/5 mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">Navigation Menu</span>
                  <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                    Beta v1.0
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Dashboard link */}
                  <button
                    onClick={() => { setActiveTab('dashboard'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'dashboard'
                        ? 'bg-emerald-500/10 text-emerald-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard size={14} className={activeTab === 'dashboard' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[1.5]'} />
                    <span>Daily Spending</span>
                  </button>

                  {/* History link */}
                  <button
                    onClick={() => { setActiveTab('history'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'history'
                        ? 'bg-emerald-500/10 text-emerald-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <History size={14} className={activeTab === 'history' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[1.5]'} />
                    <span>Expense History</span>
                  </button>

                  {/* Analytics link */}
                  <button
                    onClick={() => { setActiveTab('analytics'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'analytics'
                        ? 'bg-emerald-500/10 text-emerald-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <PieChart size={14} className={activeTab === 'analytics' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[1.5]'} />
                    <span>Trends & Insights</span>
                  </button>

                  {/* Full Budget link */}
                  <button
                    onClick={() => { setActiveTab('budget_full'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'budget_full'
                        ? 'bg-emerald-500/10 text-emerald-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Wallet size={14} className={activeTab === 'budget_full' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[1.5]'} />
                    <span>Monthly Budget (Beta)</span>
                  </button>

                  {/* Savings Goals link */}
                  <button
                    onClick={() => { setActiveTab('savings'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'savings'
                        ? 'bg-pink-500/10 text-pink-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <PiggyBank size={14} className={activeTab === 'savings' ? 'stroke-[2.5] text-pink-400' : 'stroke-[1.5]'} />
                    <span>Savings Goals</span>
                  </button>

                  {/* Settings link */}
                  <button
                    onClick={() => { setActiveTab('budget_plan'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'budget_plan'
                        ? 'bg-emerald-500/10 text-emerald-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sliders size={14} className={activeTab === 'budget_plan' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[1.5]'} />
                    <span>Settings</span>
                  </button>

                  {/* Account Reconciliation link */}
                  <button
                    onClick={() => {
                      setReconciliationStep(1);
                      setShowReconciliationModal(true);
                      setShowGlobalMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-350 hover:bg-emerald-500/10 transition-all border-0 bg-transparent cursor-pointer"
                  >
                    <RefreshCw size={14} className="stroke-[2.5] text-emerald-400" />
                    <span>Account Reconciliation 🔄</span>
                  </button>

                  {/* Firebase Cloud Sync link */}
                  <button
                    onClick={() => {
                      if (isDemoMode) {
                        setShowSubscriptionModal(true);
                      } else {
                        setShowAuthModal(true);
                      }
                      setShowGlobalMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      isDemoMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                        : 'text-emerald-400 hover:text-emerald-350 hover:bg-emerald-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Cloud size={14} className={`stroke-[2.5] ${isDemoMode ? 'text-gray-400' : 'text-emerald-400'}`} />
                      <span>Firebase Cloud Sync ☁️</span>
                    </div>
                    {isDemoMode && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                        Requires Subscription / Trial
                      </span>
                    )}
                  </button>

                  {/* Subscription & Billing link */}
                  <button
                    onClick={() => {
                      setShowSubscriptionModal(true);
                      setShowGlobalMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all border-0 bg-transparent cursor-pointer"
                  >
                    <Sparkles size={14} className="stroke-[2.5] text-amber-300" />
                    <span>Membership & Billing 💳</span>
                  </button>

                  {/* Help & Guide link */}
                  <button
                    onClick={() => { setActiveTab('help'); setShowGlobalMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all border-0 bg-transparent cursor-pointer ${
                      activeTab === 'help'
                        ? 'bg-emerald-500/10 text-emerald-400 font-extrabold'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <HelpCircle size={14} className={activeTab === 'help' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[1.5]'} />
                    <span>Help & Guide</span>
                  </button>

                  {/* PWA Install Guide Link */}
                  <button
                    onClick={() => { triggerOpenInstallGuide(); setShowGlobalMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all border-0 bg-transparent cursor-pointer"
                  >
                    <Download size={14} className="stroke-[2] text-emerald-400" />
                    <span>How to Install PWA 📲</span>
                  </button>



                  <div className="border-t border-white/5 my-1.5"></div>

                  <div className="px-2.5 py-1 mb-1">
                    <span className="text-[8px] font-extrabold text-gray-500 uppercase tracking-widest font-mono">Feedback & Support</span>
                  </div>

                  {/* Report Bug inside dropdown */}
                  <button
                    onClick={() => { handleOpenFeedback('bug'); setShowGlobalMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 transition-all border-0 bg-transparent cursor-pointer"
                  >
                    <AlertTriangle size={14} className="stroke-[2]" />
                    <span>Report Bug</span>
                  </button>

                  {/* Suggest Feature inside dropdown */}
                  <button
                    onClick={() => { handleOpenFeedback('enhancement'); setShowGlobalMenu(false); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-350 hover:bg-emerald-500/10 transition-all border-0 bg-transparent cursor-pointer"
                  >
                    <Sparkles size={14} className="stroke-[2]" />
                    <span>Suggest Feature</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Developer Mode Floating Toast Banner */}
        {devNotice && (
          <div className="bg-emerald-600/90 backdrop-blur-md text-white text-xs font-black py-2 px-4 text-center shadow-xl border-b border-emerald-400/40 animate-in slide-in-from-top duration-200 z-[100] flex items-center justify-center gap-2">
            <span>{devNotice}</span>
          </div>
        )}

        {/* Demo Mode Announcement Banner (Hidden when subscribed to maximize space) */}
        {!subscriptionState.isSubscribed && (
          <div className="px-3 pt-1.5 pb-0.5 shrink-0">
            <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-3 sm:p-3.5 shadow-lg backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-300 mt-0.5">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black tracking-wider uppercase text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                        Demo / Preview Mode ({SubscriptionManager.getTrialHoursRemaining(subscriptionState) > 0 ? `${SubscriptionManager.getTrialTimeRemainingText(subscriptionState)} Preview` : 'Preview Expired'})
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      👋 <strong>You're in Demo / Preview Mode</strong> — explore freely! Feel free to click around, view reports, and test every feature. Ready to save changes & sync across devices? Start your 5-day bonus free trial with any plan!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={14} className="fill-slate-950" />
                  <span>Start 5-Day Free Trial</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Screen Scrollable Frame */}
        <div ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto px-3.5 py-1.5 bg-[#0A0A0A] space-y-1.5">
          
          {/* Quick-add floating trigger sheet */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 overflow-y-auto transition-all">
              <div className="w-full max-w-sm my-auto animate-in slide-in-from-bottom duration-250">
                <ExpenseForm 
                  categories={categories} 
                  savingsGoals={savingsGoals}
                  onOpenCategoryManager={() => setShowCategoryManager(true)}
                  onSubmit={handleAddExpense} 
                  onClose={() => setShowAddForm(false)} 
                  defaultCategoryId={defaultCategoryId}
                  onOpenWalletSync={() => {
                    setShowAddForm(false);
                    setShowWalletSyncModal(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Edit-mode floating trigger sheet */}
          {editingExpense && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 overflow-y-auto transition-all">
              <div className="w-full max-w-sm my-auto animate-in slide-in-from-bottom duration-250">
                <ExpenseForm 
                  categories={categories} 
                  savingsGoals={savingsGoals}
                  onOpenCategoryManager={() => setShowCategoryManager(true)}
                  onSubmit={handleSaveEditedExpense} 
                  onClose={() => setEditingExpense(null)} 
                  defaultCategoryId={defaultCategoryId}
                  expenseToEdit={editingExpense}
                />
              </div>
            </div>
          )}

          {/* Delete Transaction Confirmation Modal */}
          {expenseToDelete && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center z-50 p-0 md:p-4 overflow-y-auto transition-all">
              <div className="w-full max-w-sm my-auto animate-in slide-in-from-bottom duration-250 bg-[#111111] border border-white/5 rounded-2xl p-5 shadow-2xl relative">
                
                {/* Danger Header Icon */}
                <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                  <Trash2 size={22} className="animate-pulse" />
                </div>

                <h3 className="text-sm font-bold text-white text-center uppercase tracking-wider mb-2">
                  Delete Transaction?
                </h3>
                
                <p className="text-xs text-gray-400 text-center mb-5 leading-relaxed">
                  Are you sure you want to permanently delete this transaction? This action cannot be undone.
                </p>

                {/* Transaction info summary card */}
                <div className="bg-[#0A0A0A]/80 border border-white/5 rounded-xl p-3.5 mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      categories.find(c => c.id === expenseToDelete.category)?.color || 'bg-slate-100/15 text-slate-400 border border-slate-500/10'
                    }`}>
                      {renderCategoryIcon(categories.find(c => c.id === expenseToDelete.category)?.icon || 'Tag', 14)}
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-gray-100 truncate">
                        {expenseToDelete.note || 
                          (() => {
                            const cat = categories.find(c => c.id === expenseToDelete.category);
                            return cat?.id.startsWith('SAVINGS_') ? cat.name.replace(/^SAVINGS\s*-\s*/i, '') : (cat?.name || 'Uncategorized');
                          })()}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {expenseToDelete.date} • {expenseToDelete.paymentMethod.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-rose-450 shrink-0">
                    -{currencySymbol}{expenseToDelete.amount.toFixed(2)}
                  </span>
                </div>

                {/* Two Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setExpenseToDelete(null)}
                    className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-bold text-xs transition-colors border border-white/5 cursor-pointer active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(expenseToDelete.id)}
                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-rose-500/10 cursor-pointer active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bug / Feedback Modal */}
          {showFeedbackModal && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="w-full max-w-md bg-[#111111] border border-white/5 rounded-2xl p-5 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="absolute top-4 right-4 p-1.5 hover:bg-white/5 text-gray-500 hover:text-gray-300 rounded-lg cursor-pointer border-0 bg-transparent"
                >
                  <X size={16} />
                </button>

                {/* Header Icon & Title */}
                <div className="flex items-center gap-3 border-b border-white/5 pb-3.5 mb-4 font-sans">
                  <div className={`p-2 rounded-xl border ${
                    feedbackType === 'bug'
                      ? 'bg-rose-950/20 border-rose-500/20 text-rose-400'
                      : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400'
                  }`}>
                    {feedbackType === 'bug' ? <AlertTriangle size={18} /> : <Sparkles size={18} />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#eeeeee] text-sm leading-tight">
                      {feedbackType === 'bug' ? 'Report a Bug' : 'Suggest Enhancement'}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                      Submissions open directly in your mail app to firstpayyourself@gmail.com
                    </p>
                  </div>
                </div>

                {/* Switcher inside modal */}
                <div className="grid grid-cols-2 gap-1 bg-[#0A0A0A] p-1 border border-white/5 rounded-xl mb-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackType('bug');
                    }}
                    className={`py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all border-0 bg-transparent ${
                      feedbackType === 'bug'
                        ? 'bg-rose-550/15 text-rose-400 border border-rose-500/10'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    Bug Report
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackType('enhancement');
                    }}
                    className={`py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all border-0 bg-transparent ${
                      feedbackType === 'enhancement'
                        ? 'bg-emerald-550/15 text-emerald-400 border border-emerald-500/10'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    Feature Suggestion
                  </button>
                </div>

                <form onSubmit={handleSendFeedback} className="space-y-3 font-sans">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                      Subject Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={feedbackType === 'bug' ? "e.g., Category selector freezes on scroll" : "e.g., Add custom currency symbol filters"}
                      value={feedbackTitle}
                      onChange={(e) => setFeedbackTitle(e.target.value)}
                      className="w-full bg-[#161616] border border-white/5 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition-all font-sans"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                      {feedbackType === 'bug' ? "Bug Description" : "Enhancement Idea"}
                    </label>
                    <textarea
                      required
                      rows={feedbackType === 'bug' ? 2 : 4}
                      placeholder={feedbackType === 'bug' ? "Please explain what happened..." : "Detail your suggestions or how this would benefit you..."}
                      value={feedbackDescription}
                      onChange={(e) => setFeedbackDescription(e.target.value)}
                      className="w-full bg-[#161616] border border-white/5 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition-all resize-none font-sans"
                    />
                  </div>

                  {/* Conditional Bug Report inputs */}
                  {feedbackType === 'bug' && (
                    <>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                          Steps to Reproduce (Optional)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="FOR EXAMPLE:&#10;1. Go to History tab&#10;2. Select Date range&#10;3. App crashes"
                          value={feedbackSteps}
                          onChange={(e) => setFeedbackSteps(e.target.value)}
                          className="w-full bg-[#161616] border border-white/5 rounded-xl p-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition-all resize-none font-sans"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                          Expected vs Actual (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Expected list filter, got blank screen instead"
                          value={feedbackExpected}
                          onChange={(e) => setFeedbackExpected(e.target.value)}
                          className="w-full bg-[#161616] border border-white/5 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition-all font-sans"
                        />
                      </div>
                    </>
                  )}

                  {/* Device Info Container preview */}
                  <div className="p-2.5 bg-[#0A0A0A] border border-white/5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-gray-450 uppercase tracking-wider font-mono font-bold">
                      <span>💻 Diagnostics metadata</span>
                      <span className="text-emerald-400">Included Automatically</span>
                    </div>
                    <div className="text-[7.5px] font-mono text-gray-500 leading-normal max-h-16 overflow-y-auto whitespace-pre-wrap select-all">
                      Device: {navigator.userAgent.substring(0, 70)}...&#10;Resolution: {window.screen.width}x{window.screen.height}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackModal(false)}
                      className="flex-1 py-2.5 px-4 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-bold text-xs transition-all cursor-pointer border border-white/5 active:scale-95 text-center font-sans bg-transparent"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`flex-1 py-2.5 px-4 font-bold text-xs text-white rounded-xl transition-all cursor-pointer active:scale-95 text-center flex items-center justify-center gap-1.5 border-0 font-sans ${
                        feedbackType === 'bug'
                          ? 'bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/10'
                          : 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/10'
                      }`}
                    >
                      <Download size={13} className="rotate-180 shrink-0" />
                      Send Draft
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}



          {/* Universal Month Switcher Bar */}
          {activeTab !== 'budget_plan' && activeTab !== 'help' && activeTab !== 'budget_full' && (
            <div className="bg-[#111111] py-1.5 px-3 rounded-xl border border-white/5 flex items-center justify-between shadow-xs select-none">
              <button
                onClick={handlePrevMonth}
                className="py-0.5 px-2.5 hover:bg-white/5 text-emerald-400 hover:text-emerald-300 rounded-lg text-[11px] font-bold border border-white/5 bg-transparent cursor-pointer active:scale-95 transition-all text-center"
                title="Previous Month"
              >
                ◀ Prev
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#eeeeee]">
                <Calendar size={11} className="text-emerald-500 animate-pulse" />
                <span>{totals.monthName}</span>
              </div>
              <button
                onClick={handleNextMonth}
                className="py-0.5 px-2.5 hover:bg-white/5 text-emerald-400 hover:text-emerald-300 rounded-lg text-[11px] font-bold border border-white/5 bg-transparent cursor-pointer active:scale-95 transition-all text-center"
                title="Next Month"
              >
                Next ▶
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-2.5 animate-in fade-in duration-200" id="tab_dashboard">
              
              {/* Backup Reminder Banner */}
              {showBackupReminder && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3 font-sans animate-in zoom-in-95 duration-250 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        ⚠️ Database Backup Reminder
                      </p>
                      <p className="text-[10.5px] text-gray-300 font-bold leading-normal">
                        Your transaction history has not been backed up to your device for over 7 days (or ever).
                      </p>
                      <p className="text-[9.5px] text-gray-400 leading-normal">
                        To protect your valuable financial records from browser cache clears, please take a quick backup of your database file.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-amber-500/10 pt-2.5">
                    <button
                      onClick={() => {
                        setActiveTab('budget_plan');
                      }}
                      className="py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-[9.5px] uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95 text-center border-0 outline-hidden"
                    >
                      Go to Backup 💾
                    </button>
                  </div>
                </div>
              )}

              {/* Reconciliation Reminder Banner (Only on last day of month, not during 3-day trial, and only if user has entered budget data) */}
              {!hasRunReconciliationThisMonth && !dismissedReconciliationBanner && isLastDayOfMonth && !isTrialActive && hasEnteredBudgetData && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 font-sans animate-in zoom-in-95 duration-250 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                      <RefreshCw className="animate-spin-slow text-emerald-400" size={18} />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        📅 Monthly Reconciliation Due
                      </p>
                      <p className="text-[10.5px] text-gray-300 font-bold leading-normal">
                        Today is the last day of the month! It's time to run your monthly account reconciliation process.
                      </p>
                      <p className="text-[9.5px] text-gray-400 leading-normal">
                        Reconcile your actual cash balances from chequing, savings, and cash to calculate your surplus and distribute it to your savings goals.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          localStorage.setItem('dismissed_reconciliation_date', new Date().toDateString());
                          setDismissedReconciliationBanner(true);
                        } catch (e) {}
                      }}
                      className="text-gray-400 hover:text-white p-1 cursor-pointer border-0 bg-transparent flex items-center justify-center"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex justify-end border-t border-emerald-500/10 pt-2.5 gap-2">
                    <button
                      onClick={() => {
                        try {
                          localStorage.setItem('dismissed_reconciliation_date', new Date().toDateString());
                          setDismissedReconciliationBanner(true);
                        } catch (e) {}
                      }}
                      className="py-1 px-2 text-[9px] font-semibold text-gray-400 hover:text-white rounded transition-colors cursor-pointer border-0 bg-transparent"
                    >
                      Remind Me Later
                    </button>
                    <button
                      onClick={() => {
                        setShowReconciliationModal(true);
                      }}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[9.5px] uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-95 text-center border-0 outline-hidden"
                    >
                      Start Reconciliation Process 🔄
                    </button>
                  </div>
                </div>
              )}

              {/* Circular Gauge and Budget stats header */}
              <div className="bg-[#111111] rounded-2xl p-4 border border-white/5 shadow-2xs">

                <div className="grid grid-cols-12 gap-3 items-center">
                  {/* Gauge */}
                  <div className="col-span-5 flex flex-col items-center justify-center">
                    <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-[#1c1c1c] shadow-inner bg-black/40">
                      {/* Interactive ring highlight colored according to status */}
                      <span className={`absolute inset-0 rounded-full border-4 border-transparent transition-all ${
                        totals.percent >= 100 ? 'border-t-rose-500 border-r-rose-400' :
                        totals.percent >= 80 ? 'border-t-amber-500 border-r-amber-400' :
                        statusConfig.title.includes('Spending Too Fast') ? 'border-t-yellow-500 border-r-yellow-400' :
                        'border-t-emerald-500 border-r-emerald-400'
                      }`} style={{ transform: `rotate(${(totals.percent / 100) * 180}deg)` }}></span>
                      
                      <div className="text-center z-10">
                        <span className="text-2xl font-extrabold text-white tnum tracking-tight">{totals.percent}%</span>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Spent</p>
                      </div>
                    </div>
                  </div>

                  {/* Quantitative numbers */}
                  <div className="col-span-7 space-y-2.5">
                    <div>
                      <span className="text-xs font-medium text-slate-400 block">Spent this month</span>
                      <span className="text-3xl font-extrabold text-white block mt-0.5 tnum tracking-tight">{currencySymbol}{totals.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex gap-4 border-t border-white/5 pt-2">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight block">Budget Limit</span>
                        <span className="text-sm font-bold text-slate-200 tnum">{currencySymbol}{totals.limit.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight block">Remaining</span>
                        <span className={`text-sm font-extrabold tnum ${totals.remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {currencySymbol}{totals.remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status alert message */}
                <div className={`mt-3 p-2.5 px-3 border rounded-xl text-xs flex items-start gap-2.5 ${statusConfig.color} transition-all`}>
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block tracking-tight text-xs">{statusConfig.title}</span>
                    <p className="text-[11px] leading-relaxed text-gray-300 mt-0.5">{statusConfig.desc}</p>
                  </div>
                </div>
              </div>

              {/* Pie Chart of category allocations directly underneath with tight spacing */}
              <div className="bg-[#111111] rounded-2xl p-3.5 border border-white/5 shadow-2xs">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans mb-2.5">
                  Spending by Category
                </h3>
                
                {categoryStats.length === 0 ? (
                  <div className="text-center py-6 bg-black/40 border border-white/5 rounded-xl text-gray-500 text-xs">
                    Please log transaction items to model charts.
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 h-[110px] w-full text-[9px] relative flex items-center justify-center">
                      {renderCharts ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <RePieChart>
                            <Pie
                              data={categoryPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={24}
                              outerRadius={40}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {categoryPieData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.color} 
                                  className="cursor-pointer stroke-none outline-hidden hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    setFilterCategories([entry.id]);
                                    setActiveTab('history');
                                  }}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: any) => [`${currencySymbol}${value}`, 'Amount']} />
                          </RePieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[110px] w-full" />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xs font-extrabold text-white leading-none tnum">{currencySymbol}{totals.totalSpent.toFixed(2)}</span>
                        <span className="text-[8px] text-gray-400 font-semibold tracking-tight uppercase mt-0.5">Spent</span>
                      </div>
                    </div>

                    <div className="col-span-7 flex flex-col h-[110px]">
                      <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide block mb-1 shrink-0">Click to filter:</span>
                      <div className="space-y-1 overflow-y-auto pr-1 flex-1 scrollbar-thin">
                        {categoryStats.map((stat) => (
                          <div 
                            key={stat.id} 
                            className="flex items-center justify-between text-[11px] cursor-pointer hover:bg-white/5 px-2 py-1 rounded-lg transition-all duration-150 group"
                            onClick={() => {
                              setFilterCategories([stat.id]);
                              setActiveTab('history');
                            }}
                            title={`Click to view all ${stat.label} transactions`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{
                                backgroundColor: resolveColorHex(stat.color)
                              }} />
                              <span className="text-gray-300 truncate font-medium group-hover:text-emerald-400 transition-colors">{stat.label}</span>
                            </div>
                            <span className="font-bold text-white shrink-0 group-hover:text-emerald-400 transition-colors tnum text-xs">{currencySymbol}{stat.total.toFixed(2)} →</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TRANSACTIONS HISTORY VIEW */}
          {activeTab === 'history' && (
            <div className="space-y-2 animate-in fade-in duration-200" id="tab_history">
              <div className="bg-[#111111] rounded-2xl p-3 border border-white/5 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-bold text-white uppercase tracking-widest">Expenses Entered</h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportToCSV}
                      className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-[9px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      title="Export filtered expenses to Excel/CSV spreadsheet"
                    >
                      <FileSpreadsheet size={11} />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportToPDF}
                      className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[9px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      title="Export filtered expenses as a beautiful PDF Invoice/Statement report"
                    >
                      <FileText size={11} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="space-y-1.5 mb-2.5">
                  {/* Search text */}
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-gray-500">
                      <Search size={13} />
                    </span>
                    <input
                      type="text"
                      placeholder="Search transactions or notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-8 py-1 text-xs bg-black/40 border border-white/10 text-white focus:border-emerald-500 focus:bg-[#0A0A0A] rounded-lg outline-hidden"
                    />
                    {searchQuery && (
                      <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1.5 py-0.5 text-gray-500 hover:text-white text-xs cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Filters row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative" ref={categoryDropdownRef}>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[8px] font-bold text-slate-300 uppercase tracking-wider">Tag Category</label>
                        {filterCategories.length > 0 && (
                          <button 
                            type="button" 
                            onClick={() => setFilterCategories([])}
                            className="text-[8px] text-emerald-400 hover:underline font-extrabold cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                        className="w-full py-1 px-2 bg-black/40 text-[10px] border border-white/10 rounded-lg text-gray-200 flex items-center justify-between hover:bg-black/60 focus:border-emerald-500/50 transition-colors cursor-pointer"
                      >
                        <span className="truncate pr-1 font-medium">
                          {filterCategories.length === 0 && "📁 All Categories"}
                          {filterCategories.length === 1 && (
                            (() => {
                              const cat = categories.find(c => c.id === filterCategories[0]);
                              const isSavings = cat?.id.startsWith('SAVINGS_');
                              const name = isSavings ? cat.name.replace(/^SAVINGS\s*-\s*/i, '') : cat?.name;
                              return cat ? (isSavings ? `🐷 ${name}` : `📁 ${name}`) : "📁 1 Selected";
                            })()
                          )}
                          {filterCategories.length > 1 && `📁 ${filterCategories.length} Categories`}
                        </span>
                        {isCategoryFilterOpen ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
                      </button>

                      {/* Multi-Category Selection Dropdown */}
                      {isCategoryFilterOpen && (
                        <div className="absolute left-0 top-full mt-1 z-30 w-64 bg-[#161616] border border-white/15 rounded-xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150">
                          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                            <span className="text-[9px] font-extrabold text-gray-200 uppercase tracking-wider">Filter Categories</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFilterCategories([])}
                                className="text-[8.5px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 font-bold cursor-pointer"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={() => setFilterCategories(categories.map(c => c.id))}
                                className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold cursor-pointer"
                              >
                                Select All
                              </button>
                            </div>
                          </div>

                          <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                            {categories.map(c => {
                              const isSelected = filterCategories.includes(c.id);
                              const isSavings = c.id.startsWith('SAVINGS_');
                              const catName = isSavings ? c.name.replace(/^SAVINGS\s*-\s*/i, '') : c.name;

                              return (
                                <label
                                  key={c.id}
                                  className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] cursor-pointer transition-colors ${
                                    isSelected ? 'bg-emerald-500/15 text-emerald-200 font-semibold border border-emerald-500/25' : 'hover:bg-white/5 text-gray-300 border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-1">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleCategoryFilter(c.id)}
                                      className="rounded border-white/20 bg-black text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 shrink-0"
                                    />
                                    <span className="truncate">
                                      {isSavings ? `🐷 [Savings] ${catName}` : catName}
                                    </span>
                                  </div>
                                  {isSelected && <CheckCircle size={11} className="text-emerald-400 shrink-0 ml-1" />}
                                </label>
                              );
                            })}
                          </div>

                          <div className="pt-2 mt-2 border-t border-white/10 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setIsCategoryFilterOpen(false)}
                              className="w-full py-1 bg-emerald-500 text-black font-extrabold text-[10px] rounded-lg hover:bg-emerald-400 transition-colors cursor-pointer text-center"
                            >
                              Apply Filter
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[8px] font-bold text-slate-300 uppercase tracking-wider mb-0.5">Payment Channel</label>
                      <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="w-full py-1 px-1.5 bg-black/40 text-[10px] border border-white/10 rounded-lg text-gray-300"
                      >
                        <option value="all" className="bg-[#111111]">💳 All Methods</option>
                        <option value="card" className="bg-[#111111]">Card Payment</option>
                        <option value="digital_wallet" className="bg-[#111111]">Digital Wallet</option>
                        <option value="cash" className="bg-[#111111]">Paper Cash</option>
                        <option value="other" className="bg-[#111111]">Other Type</option>
                      </select>
                    </div>
                  </div>

                  {/* Selected Categories Active Filter Chips */}
                  {filterCategories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                      <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Filtered ({filterCategories.length}):</span>
                      {filterCategories.map(catId => {
                        const cat = categories.find(c => c.id === catId);
                        if (!cat) return null;
                        const isSavings = cat.id.startsWith('SAVINGS_');
                        const name = isSavings ? cat.name.replace(/^SAVINGS\s*-\s*/i, '') : cat.name;

                        return (
                          <span 
                            key={catId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9.5px] font-semibold"
                          >
                            <span>{isSavings ? `🐷 ${name}` : name}</span>
                            <button
                              type="button"
                              onClick={() => toggleCategoryFilter(catId)}
                              className="hover:text-white cursor-pointer ml-0.5 p-0.5 rounded-full hover:bg-emerald-500/30 transition-colors"
                              title="Remove filter"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                      {filterCategories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFilterCategories([])}
                          className="text-[8.5px] text-gray-400 hover:text-white font-bold ml-1 cursor-pointer underline"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  )}

                  {/* Date Range filters */}
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[8px] font-bold text-slate-300 uppercase tracking-wider">Start Date</label>
                        {filterStartDate && (
                          <button
                            type="button"
                            onClick={() => setFilterStartDate("")}
                            className="text-[8px] text-red-500 hover:text-red-400 font-bold bg-transparent border-0 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={filterStartDate}
                          onClick={() => {
                            setShowStartDateCalendar(!showStartDateCalendar);
                            setShowEndDateCalendar(false);
                          }}
                          className="w-full pl-2 pr-7 py-1 bg-black/40 text-[10px] border border-white/10 rounded-lg text-gray-300 focus:border-emerald-500 focus:outline-[#10b981] select-none block font-mono cursor-pointer"
                          placeholder="Select Start Date"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowStartDateCalendar(!showStartDateCalendar);
                            setShowEndDateCalendar(false);
                          }}
                          className="absolute right-2 top-1 text-gray-400 hover:text-emerald-400 transition-all cursor-pointer bg-transparent border-0"
                          title="Open Start Date Calendar"
                        >
                          <Calendar size={12} className={showStartDateCalendar ? "text-emerald-400 scale-110 transition-all" : "transition-all"} />
                        </button>
                      </div>

                      {/* Custom Popup for Start Date Calendar */}
                      {showStartDateCalendar && (
                        <div 
                          ref={startDateCalendarRef}
                          className="absolute left-0 mt-1.5 p-3 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-50 text-white text-xs w-64 select-none animate-in fade-in zoom-in-95 duration-150"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 font-sans">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (startCalendarMonth === 0) {
                                  setStartCalendarMonth(11);
                                  setStartCalendarYear(y => y - 1);
                                } else {
                                  setStartCalendarMonth(m => m - 1);
                                }
                              }}
                              className="p-1 px-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-md cursor-pointer border-0 bg-transparent text-[10px]"
                            >
                              ◀
                            </button>
                            <span className="font-bold text-[9px] uppercase tracking-widest text-[#eeeeee]">
                              {new Date(startCalendarYear, startCalendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (startCalendarMonth === 11) {
                                    setStartCalendarMonth(0);
                                    setStartCalendarYear(y => y + 1);
                                  } else {
                                    setStartCalendarMonth(m => m + 1);
                                  }
                                }}
                                className="p-1 px-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-md cursor-pointer border-0 bg-transparent text-[10px]"
                              >
                                ▶
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowStartDateCalendar(false);
                                }}
                                className="p-1 hover:bg-white/10 text-gray-400 hover:text-rose-400 rounded-md cursor-pointer border-0 bg-transparent text-[10px] ml-1"
                                title="Close Calendar"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Day headers */}
                          <div className="grid grid-cols-7 text-center text-[8px] font-bold uppercase text-gray-500 mb-1">
                            <span>S</span>
                            <span>M</span>
                            <span>T</span>
                            <span>W</span>
                            <span>T</span>
                            <span>F</span>
                            <span>S</span>
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1 text-center font-mono">
                            {Array.from({ length: new Date(startCalendarYear, startCalendarMonth, 1).getDay() }).map((_, idx) => (
                              <span key={`empty-start-${idx}`} />
                            ))}

                            {Array.from({ length: new Date(startCalendarYear, startCalendarMonth + 1, 0).getDate() }).map((_, idx) => {
                              const dayNum = idx + 1;
                              const thisDateString = `${startCalendarYear}-${(startCalendarMonth + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                              const isSelected = thisDateString === filterStartDate;

                              return (
                                <button
                                  key={`day-start-${dayNum}`}
                                  type="button"
                                  onClick={() => {
                                    setFilterStartDate(thisDateString);
                                    setShowStartDateCalendar(false);
                                  }}
                                  className={`p-1 text-[10px] rounded-md transition-colors cursor-pointer border-0 active:scale-95 ${
                                    isSelected 
                                      ? 'bg-emerald-600 text-white font-bold' 
                                      : 'text-gray-300 hover:bg-white/5 hover:text-white bg-transparent'
                                  }`}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative font-sans">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[8px] font-bold text-slate-300 uppercase tracking-wider">End Date</label>
                        {filterEndDate && (
                          <button
                            type="button"
                            onClick={() => setFilterEndDate("")}
                            className="text-[8px] text-red-500 hover:text-red-400 font-bold bg-transparent border-0 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={filterEndDate}
                          onClick={() => {
                            setShowEndDateCalendar(!showEndDateCalendar);
                            setShowStartDateCalendar(false);
                          }}
                          className="w-full pl-2 pr-7 py-1 bg-black/40 text-[10px] border border-white/10 rounded-lg text-gray-300 focus:border-emerald-500 focus:outline-[#10b981] select-none block font-mono cursor-pointer"
                          placeholder="Select End Date"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowEndDateCalendar(!showEndDateCalendar);
                            setShowStartDateCalendar(false);
                          }}
                          className="absolute right-2 top-1 text-gray-400 hover:text-emerald-400 transition-all cursor-pointer bg-transparent border-0"
                          title="Open End Date Calendar"
                        >
                          <Calendar size={12} className={showEndDateCalendar ? "text-emerald-400 scale-110 transition-all" : "transition-all"} />
                        </button>
                      </div>

                      {/* Custom Popup for End Date Calendar */}
                      {showEndDateCalendar && (
                        <div 
                          ref={endDateCalendarRef}
                          className="absolute right-0 mt-1.5 p-3 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-50 text-white text-xs w-64 select-none animate-in fade-in zoom-in-95 duration-150"
                        >
                          {/* Header */}
                          <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 font-sans">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (endCalendarMonth === 0) {
                                  setEndCalendarMonth(11);
                                  setEndCalendarYear(y => y - 1);
                                } else {
                                  setEndCalendarMonth(m => m - 1);
                                }
                              }}
                              className="p-1 px-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-md cursor-pointer border-0 bg-transparent text-[10px]"
                            >
                              ◀
                            </button>
                            <span className="font-bold text-[9px] uppercase tracking-widest text-[#eeeeee]">
                              {new Date(endCalendarYear, endCalendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (endCalendarMonth === 11) {
                                    setEndCalendarMonth(0);
                                    setEndCalendarYear(y => y + 1);
                                  } else {
                                    setEndCalendarMonth(m => m + 1);
                                  }
                                }}
                                className="p-1 px-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-md cursor-pointer border-0 bg-transparent text-[10px]"
                              >
                                ▶
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEndDateCalendar(false);
                                }}
                                className="p-1 hover:bg-white/10 text-gray-400 hover:text-rose-400 rounded-md cursor-pointer border-0 bg-transparent text-[10px] ml-1"
                                title="Close Calendar"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Day headers */}
                          <div className="grid grid-cols-7 text-center text-[8px] font-bold uppercase text-gray-500 mb-1">
                            <span>S</span>
                            <span>M</span>
                            <span>T</span>
                            <span>W</span>
                            <span>T</span>
                            <span>F</span>
                            <span>S</span>
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1 text-center font-mono">
                            {Array.from({ length: new Date(endCalendarYear, endCalendarMonth, 1).getDay() }).map((_, idx) => (
                              <span key={`empty-end-${idx}`} />
                            ))}

                            {Array.from({ length: new Date(endCalendarYear, endCalendarMonth + 1, 0).getDate() }).map((_, idx) => {
                              const dayNum = idx + 1;
                              const thisDateString = `${endCalendarYear}-${(endCalendarMonth + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                              const isSelected = thisDateString === filterEndDate;

                              return (
                                <button
                                  key={`day-end-${dayNum}`}
                                  type="button"
                                  onClick={() => {
                                    setFilterEndDate(thisDateString);
                                    setShowEndDateCalendar(false);
                                  }}
                                  className={`p-1 text-[10px] rounded-md transition-colors cursor-pointer border-0 active:scale-95 ${
                                    isSelected 
                                      ? 'bg-emerald-600 text-white font-bold' 
                                      : 'text-gray-300 hover:bg-white/5 hover:text-white bg-transparent'
                                  }`}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* List of Filtered Expenses */}
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <p className="text-xs">No matching transactions found.</p>
                    <p className="text-[10px] mt-1">Try resetting filters or enter a direct expense category query.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto pr-1">
                    {filteredExpenses.map((exp) => {
                      const cat = categories.find(c => c.id === exp.category);
                      const isBusiness = exp.category === 'cat_business_expense';
                      return (
                        <div key={exp.id} className="py-1.5 flex items-center justify-between group">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Category Icon with Custom Colors */}
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                              cat?.color ? cat.color : 'bg-slate-100/15 text-slate-400 border border-slate-500/10'
                            }`}>
                              {renderCategoryIcon(cat?.icon || 'Tag', 12)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate leading-tight flex items-center gap-1.5 flex-wrap">
                                <span>{exp.note || (cat?.id.startsWith('SAVINGS_') ? cat.name.replace(/^SAVINGS\s*-\s*/i, '') : cat?.name) || 'Uncategorized'}</span>
                                {isBusiness && (
                                  <span className="px-1.5 py-0.5 text-[8px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded uppercase tracking-wider leading-none shrink-0">
                                    Business
                                  </span>
                                )}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {exp.date} • {exp.paymentMethod.replace('_', ' ')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-sm font-extrabold tnum block mr-1 ${
                              isBusiness ? 'text-indigo-400' : 'text-rose-400'
                            }`}>
                              -{currencySymbol}{exp.amount.toFixed(2)}
                            </span>
                            <button
                              onClick={() => setEditingExpense(exp)}
                              className="p-1.5 hover:bg-emerald-500/15 text-gray-400 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer border-0 bg-transparent active:scale-95"
                              title="Edit this transaction"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setExpenseToDelete(exp)}
                              className="p-1.5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer border-0 bg-transparent active:scale-95"
                              title="Delete this transaction permanently"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CHARTS AND ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-2 animate-in fade-in duration-200" id="tab_analytics">
              {/* Spending to Date Category progress bars */}
              <div className="bg-[#111111] rounded-2xl p-4 border border-white/5 shadow-2xs">
                <div className="flex items-center justify-between mb-3.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">Spending to date</h3>
                  <span className="text-[10px] text-slate-400 font-semibold">Tap bar to view ledger</span>
                </div>

                {categoryStats.length === 0 ? (
                  <div className="text-center py-6 bg-black/40 border border-white/5 rounded-xl text-gray-500 text-xs">
                    Please log transaction items to view spending bars.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {categoryStats.map((stat) => {
                      const catLimit = stat.limit || 0;
                      const remaining = catLimit - stat.total;
                      const share = catLimit > 0 ? Math.round((stat.total / catLimit) * 100) : 100;
                      return (
                        <div 
                          key={stat.id} 
                          className="space-y-1.5 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-xl transition-all duration-150 relative group"
                          onClick={() => {
                            setFilterCategories([stat.id]);
                            setActiveTab('history');
                          }}
                          title={`Click to view all ${stat.label} transactions`}
                        >
                          <div className="flex items-start justify-between text-xs">
                            <div className="min-w-0">
                              <span className="font-semibold text-gray-200 block truncate group-hover:text-emerald-400 transition-colors">{stat.label}</span>
                              <span className={`text-[11px] tnum leading-none ${remaining >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-semibold'}`}>
                                {remaining >= 0 ? `${currencySymbol}${remaining.toFixed(2)} remaining` : `${currencySymbol}${Math.abs(remaining).toFixed(2)} over limit`}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="tnum font-bold text-slate-200 block text-xs">{currencySymbol}{stat.total.toFixed(2)} <span className="text-slate-500 font-normal">/ {currencySymbol}{catLimit.toFixed(2)}</span></span>
                              <span className="text-[10px] text-slate-400 font-semibold block group-hover:text-emerald-400 transition-colors">({share}%) →</span>
                            </div>
                          </div>
                          <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/5">
                            <div 
                              className={`h-full rounded-full transition-all group-hover:brightness-110 ${
                                share >= 100 ? 'bg-rose-500' :
                                share >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`} 
                              style={{ width: `${Math.min(share, 100)}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Line Chart showing progression pacing against limit */}
              <div className="bg-[#111111] rounded-2xl p-3 border border-white/5 shadow-2xs">
                <h2 className="text-xs font-bold text-white uppercase tracking-widest mb-0.5 font-sans">
                  Cumulative Spending this Month
                </h2>
                <p className="text-[9px] text-gray-455 mb-1.5 leading-tight">
                  Daily spending (solid line) against total limits (horizontal marker).
                </p>

                {trendChartData.length === 0 || totals.totalSpent === 0 ? (
                  <div className="text-center py-6 bg-black/40 border border-white/5 rounded-xl text-gray-500 text-xs">
                    No data logged for the line charts. Log expenses to generate lines.
                  </div>
                ) : (
                  <div className="h-[140px] w-full text-[9px]">
                    {renderCharts ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={trendChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
                          <XAxis dataKey="day" stroke="#9ca3af" tickLine={false} tick={{ fill: '#f3f4f6', fontWeight: 500 }} />
                          <YAxis stroke="#9ca3af" tickLine={false} tick={{ fill: '#f3f4f6', fontWeight: 500 }} />
                          <Tooltip 
                            contentStyle={{ fontSize: '9px', background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                            formatter={(value: any) => [`${currencySymbol}${value}`, 'Cumulative Spent']}
                            labelFormatter={(label) => `Day ${label} of month`}
                          />
                          <ReferenceLine y={totals.limit} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Limit', position: 'insideTopRight', fill: '#ef4444', fontSize: 7 }} />
                          <Line type="monotone" dataKey="cumulativeSpend" stroke={totals.totalSpent > totals.limit ? "#ef4444" : "#10b981"} strokeWidth={2} dot={{ r: 0.5 }} activeDot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[140px] w-full" />
                    )}
                  </div>
                )}
              </div>

              {/* Bar Chart: Daily Individual Transactions */}
              <div className="bg-[#111111] rounded-2xl p-3 border border-white/5 shadow-2xs">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-0.5 font-sans">
                  Daily Spending
                </h3>
                <p className="text-[9px] text-gray-400 mb-1.5 font-sans">Individual daily spending amounts.</p>

                {totals.totalSpent === 0 ? (
                  <div className="text-center py-6 bg-black/40 border border-[#242424] rounded-xl text-gray-500 text-xs">No entries to display.</div>
                ) : (
                  <div className="h-[100px] w-full text-[9px]">
                    {renderCharts ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={trendChartData.slice(-14)} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f1f1f" />
                          <XAxis dataKey="day" stroke="#9ca3af" tickLine={false} tick={{ fill: '#f3f4f6', fontWeight: 500 }} />
                          <YAxis stroke="#9ca3af" tickLine={false} tick={{ fill: '#f3f4f6', fontWeight: 500 }} />
                          <Tooltip 
                            contentStyle={{ fontSize: '9px', background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                            formatter={(value: any) => [`${currencySymbol}${value}`, 'Daily Total']}
                          />
                          <Bar dataKey="dailySpend" fill="#10b981" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[100px] w-full" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BUDGET & LOCAL ARCHITECTURE SETUP */}
          {activeTab === 'budget_plan' && (
            <div className="space-y-4 animate-in fade-in duration-200 animate-in fade-in slide-in-from-bottom-2" id="tab_budget">
              <BudgetSettings 
                categories={categories} 
                currentBudget={currentBudget} 
                onBudgetUpdated={handleUpdateBudget} 
                onDatabaseReset={handleResetDatabase} 
                onCategoryAdded={handleAddCategory}
                onCategoryUpdated={handleUpdateCategory}
                onCategoryDeleted={handleDeleteCategory}
                defaultCategoryId={defaultCategoryId}
                currencySymbol={currencySymbol}
                onCurrencyChanged={handleCurrencyChange}
                isDevMode={isDevMode}
                activeThemeId={accentThemeId}
                onThemeChanged={setAccentThemeId}
                showSimulatedAds={showSimulatedAds}
                onShowSimulatedAdsChange={handleShowSimulatedAdsChange}
                onLoadDemoData={handleLoadDemoData}
                onBackupCompleted={() => setLastBackupTime(Date.now())}
                subscriptionState={subscriptionState}
                onOpenSubscriptionModal={() => setShowSubscriptionModal(true)}
                isCloudSynced={!!currentUser}
                onWipeCloudDatabase={handleWipeCloudDatabase}
                onOpenCategoryManager={() => setShowCategoryManager(true)}
                openAddOnLaunch={openAddOnLaunch}
                onOpenAddOnLaunchChange={handleOpenAddOnLaunchChange}
                onOpenWalletSync={() => setShowWalletSyncModal(true)}
              />
            </div>
          )}

          {/* TAB 5: FULL MONTHLY BUDGET (PREVIEW MODE) */}
          {activeTab === 'budget_full' && (() => {
            const totalIncome = incomeStreams.filter(item => !item.isHidden).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
            const totalFixed = fixedExpenses.filter(item => !item.isHidden).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
            const totalDiscretionary = categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_') && !c.isHidden).reduce((sum, c) => sum + (Number(c?.limit) || 0), 0);
            const totalSavings = savingsGoals.filter(item => !item.isHidden).reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
            const overallSurplus = totalIncome - (totalFixed + totalDiscretionary + totalSavings);

            return (
              <div className="space-y-4 animate-in fade-in duration-200" id="tab_budget_full">
                
                {/* Warning if Discretionary Budget goes negative */}
                {overallSurplus < 0 && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-[10px] font-semibold animate-pulse shadow-md shadow-rose-950/20">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>Warning: Budget allocations & savings exceed total income by {currencySymbol}{Math.abs(overallSurplus).toLocaleString()}!</span>
                  </div>
                )}
                <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
                  <button 
                    onClick={() => toggleAccordion('income')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/2 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 bg-emerald-500/15 border border-emerald-500/25 rounded-lg text-emerald-400">
                        <Wallet size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[#eeeeee] text-[11px] uppercase tracking-wider">Income</span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded font-sans">
                            {incomeStreams.length} SOURCES
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Primary salary, side income, investments</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold tnum text-emerald-400">
                        {currencySymbol}{totalIncome.toLocaleString()}
                      </span>
                      {accordionOpen.income ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </button>

                  {accordionOpen.income && (
                    <div className="p-3 border-t border-white/5 bg-black/20 space-y-2.5">
                      
                      {/* Column Header: Budget */}
                      <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest pb-1 border-b border-white/5 px-1">
                        <span>Income Source</span>
                        <span className="pr-6.5">Amount</span>
                      </div>

                      <div className="divide-y divide-white/5 space-y-1.5">
                        {incomeStreams.map((item) => (
                          <div key={item.id} className="flex items-center justify-between pt-1.5 first:pt-0 group">
                            {editingItemId === item.id ? (
                              <input 
                                type="text"
                                value={editingItemValue}
                                onChange={(e) => setEditingItemValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingItemValue.trim()) {
                                      if (isDuplicateName(editingItemValue, 'income', item.id)) {
                                        alert(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                        setEditingItemId(null);
                                        return;
                                      }
                                      handleUpdateIncomeStream(item.id, { label: editingItemValue.trim() });
                                    }
                                    setEditingItemId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingItemId(null);
                                  }
                                }}
                                onBlur={() => {
                                  if (editingItemValue.trim()) {
                                    if (isDuplicateName(editingItemValue, 'income', item.id)) {
                                      alert(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                      setEditingItemId(null);
                                      return;
                                    }
                                    handleUpdateIncomeStream(item.id, { label: editingItemValue.trim() });
                                  }
                                  setEditingItemId(null);
                                }}
                                className="px-2 py-0.5 bg-black/60 border border-emerald-500/30 text-xs text-white rounded-lg outline-none w-32 font-medium font-sans"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs font-medium truncate ${item.isHidden ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.label}</span>
                                {item.isHidden && (
                                  <span className="text-[7.5px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-mono font-bold uppercase shrink-0">
                                    Hidden
                                  </span>
                                )}
                                <button 
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditingItemValue(item.label);
                                  }}
                                  className="p-0.5 text-gray-500 hover:text-emerald-400 transition-all cursor-pointer rounded shrink-0"
                                  title="Edit Name"
                                >
                                  <Pencil size={10} />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <DirectAmountInput 
                                initialValue={item.amount}
                                onUpdate={(val) => handleUpdateIncomeStream(item.id, val)}
                                currencySymbol={currencySymbol}
                                className="w-28 pl-4.5 pr-2 py-1 bg-black/40 border border-white/10 focus:border-emerald-500/50 outline-none rounded-lg text-[11px] font-mono text-right font-bold text-white transition-all"
                              />
                              <button 
                                onClick={() => handleUpdateIncomeStream(item.id, { isHidden: !item.isHidden })}
                                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                                  item.isHidden 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                                title={item.isHidden ? 'Unhide Income Category' : 'Hide Income Category'}
                              >
                                {item.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Income Stream Mini Form */}
                      <form onSubmit={handleAddIncomeStream} className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                        <input 
                          type="text"
                          placeholder="Add Custom Income Budget Category"
                          value={newIncomeName}
                          onChange={(e) => {
                            setNewIncomeName(e.target.value);
                            setFormErrors(prev => ({ ...prev, income: null }));
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 bg-black/40 border border-emerald-500/30 focus:border-emerald-500/60 outline-none rounded-lg text-[10px] text-emerald-400 placeholder:text-emerald-400 font-medium font-sans placeholder:opacity-100"
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-500 font-bold">{currencySymbol}</span>
                          <input 
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newIncomeAmount}
                            onChange={(e) => {
                              setNewIncomeAmount(e.target.value);
                              setFormErrors(prev => ({ ...prev, income: null }));
                            }}
                            className="w-24 pl-4.5 pr-1.5 py-1.5 bg-black/40 border border-emerald-500/20 focus:border-emerald-500/50 outline-none rounded-lg text-[10px] text-emerald-400 font-mono text-right font-bold"
                          />
                        </div>
                        <button 
                          type="submit"
                          className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title="Add item"
                        >
                          <Plus size={13} className="stroke-[2.5]" />
                        </button>
                      </form>
                      {formErrors.income && (
                        <p className="text-[9px] text-rose-400 font-bold mt-1.5 text-left bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 animate-pulse">{formErrors.income}</p>
                      )}

                    </div>
                  )}
                </div>

                {/* ACCORDION 1: FIXED EXPENSES */}
                <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
                  <button 
                    onClick={() => toggleAccordion('fixed')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/2 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 bg-sky-500/15 border border-sky-500/25 rounded-lg text-sky-400">
                        <Building size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[#eeeeee] text-[11px] uppercase tracking-wider">Known Expenses</span>
                          <span className="text-[9px] bg-sky-500/10 text-sky-400 font-bold px-1.5 py-0.5 rounded font-sans">
                            {fixedExpenses.length} ITEMS
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Recurring commitments, housing & taxes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold tnum text-sky-400">
                        {currencySymbol}{totalFixed.toLocaleString()}
                      </span>
                      {accordionOpen.fixed ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </button>

                  {accordionOpen.fixed && (
                    <div className="p-3 border-t border-white/5 bg-black/20 space-y-2.5">
                      
                      {/* Column Header: Budget */}
                      <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest pb-1 border-b border-white/5 px-1">
                        <span>Known Commitment</span>
                        <span className="pr-6.5">Budget</span>
                      </div>

                      <div className="divide-y divide-white/5 space-y-1.5">
                        {fixedExpenses.map((item) => (
                          <div key={item.id} className="flex items-center justify-between pt-1.5 first:pt-0 group">
                            {editingItemId === item.id ? (
                              <input 
                                type="text"
                                value={editingItemValue}
                                onChange={(e) => setEditingItemValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    if (editingItemValue.trim()) {
                                      if (editingItemValue.toLowerCase().includes('savings')) {
                                        alert("Known commitment / Fixed expense names cannot contain the word 'savings' to prevent conflict with Savings Goal categories.");
                                        setEditingItemId(null);
                                        return;
                                      }
                                      if (isDuplicateName(editingItemValue, 'fixed', item.id)) {
                                        alert(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                        setEditingItemId(null);
                                        return;
                                      }
                                      handleUpdateFixedExpense(item.id, { label: editingItemValue.trim() });
                                    }
                                    setEditingItemId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingItemId(null);
                                  }
                                }}
                                onBlur={() => {
                                  if (editingItemValue.trim()) {
                                    if (editingItemValue.toLowerCase().includes('savings')) {
                                      alert("Known commitment / Fixed expense names cannot contain the word 'savings' to prevent conflict with Savings Goal categories.");
                                      setEditingItemId(null);
                                      return;
                                    }
                                    if (isDuplicateName(editingItemValue, 'fixed', item.id)) {
                                      alert(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                      setEditingItemId(null);
                                      return;
                                    }
                                    handleUpdateFixedExpense(item.id, { label: editingItemValue.trim() });
                                  }
                                  setEditingItemId(null);
                                }}
                                className="px-2 py-0.5 bg-black/60 border border-sky-500/30 text-xs text-white rounded-lg outline-none w-32 font-medium font-sans"
                                autoFocus
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`text-xs font-medium truncate ${item.isHidden ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.label}</span>
                                {item.isHidden && (
                                  <span className="text-[7.5px] bg-sky-500/15 text-sky-400 border border-sky-500/20 px-1 py-0.2 rounded font-mono font-bold uppercase shrink-0">
                                    Hidden
                                  </span>
                                )}
                                <button 
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditingItemValue(item.label);
                                  }}
                                  className="p-0.5 text-gray-500 hover:text-sky-400 transition-all cursor-pointer rounded shrink-0"
                                  title="Edit Name"
                                >
                                  <Pencil size={10} />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <DirectAmountInput 
                                initialValue={item.amount}
                                onUpdate={(val) => handleUpdateFixedExpense(item.id, val)}
                                currencySymbol={currencySymbol}
                                className="w-28 pl-4.5 pr-2 py-1 bg-black/40 border border-white/10 focus:border-sky-500/50 outline-none rounded-lg text-[11px] font-mono text-right font-bold text-white transition-all"
                              />
                              <button 
                                onClick={() => handleUpdateFixedExpense(item.id, { isHidden: !item.isHidden })}
                                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                                  item.isHidden 
                                    ? 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20' 
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                                title={item.isHidden ? 'Unhide Known Expense' : 'Hide Known Expense'}
                              >
                                {item.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Known Expense Mini Form */}
                      <form onSubmit={handleAddFixedExpense} className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                        <input 
                          type="text"
                          placeholder="Add Custom Known Budget Category"
                          value={newFixedName}
                          onChange={(e) => {
                            setNewFixedName(e.target.value);
                            setFormErrors(prev => ({ ...prev, fixed: null }));
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 bg-black/40 border border-emerald-500/30 focus:border-emerald-500/60 outline-none rounded-lg text-[10px] text-emerald-400 placeholder:text-emerald-400 font-medium font-sans placeholder:opacity-100"
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-500 font-bold">{currencySymbol}</span>
                          <input 
                            type="number"
                            placeholder="0"
                            min="0"
                            step="0.01"
                            value={newFixedAmount}
                            onChange={(e) => {
                              setNewFixedAmount(e.target.value);
                              setFormErrors(prev => ({ ...prev, fixed: null }));
                            }}
                            className="w-24 pl-4.5 pr-1.5 py-1.5 bg-black/40 border border-emerald-500/20 focus:border-emerald-500/50 outline-none rounded-lg text-[10px] text-emerald-400 font-mono text-right font-bold"
                          />
                        </div>
                        <button 
                          type="submit"
                          className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title="Add item"
                        >
                          <Plus size={13} className="stroke-[2.5]" />
                        </button>
                      </form>
                      {formErrors.fixed && (
                        <p className="text-[9px] text-rose-400 font-bold mt-1.5 text-left bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 animate-pulse">{formErrors.fixed}</p>
                      )}
                    </div>
                  )}
                </div>

                 {/* ACCORDION 2: DAILY SPENDING */}
                <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
                  <button 
                    onClick={() => toggleAccordion('discretionary')}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/2 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 bg-amber-500/15 border border-amber-500/25 rounded-lg text-amber-400">
                        <CreditCard size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-[#eeeeee] text-[11px] uppercase tracking-wider">Daily Spending</span>
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-1 py-0.2 rounded font-mono">
                            LIVE SYNC
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5">Flexible spending (Saves directly to database)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold font-mono text-amber-400">
                        {currencySymbol}{totalDiscretionary.toLocaleString()}
                      </span>
                      {accordionOpen.discretionary ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Budget Balance Line right below header */}
                  <div className="px-3.5 py-2 bg-white/2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">Budget Balance</span>
                    <span className={`text-[10px] font-black font-mono px-2 py-0.5 rounded-lg ${
                      overallSurplus >= 0 
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                        : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    }`}>
                      {overallSurplus >= 0 ? '+' : ''}{currencySymbol}{overallSurplus.toLocaleString()}
                    </span>
                  </div>

                  {accordionOpen.discretionary && (
                    <div className="p-3 border-t border-white/5 bg-black/20 space-y-2">
                      <p className="text-[9px] text-gray-400 italic mb-1">
                        Tip: Changing the limits here updates your active category budget goals instantly across the entire app.
                      </p>

                      <button
                        type="button"
                        onClick={() => setShowCategoryManager(true)}
                        className="w-full mb-3.5 py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/10 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-[10px] font-bold tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-xs"
                      >
                        <Sparkles size={11} className="animate-pulse shrink-0 text-emerald-400" /> Add/Edit Daily Spending Budget Category
                      </button>

                      {/* Column Header: Budget */}
                      <div className="flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest pb-1 border-b border-white/5 px-1">
                        <span>Daily Spending Category</span>
                        <span className="pr-6.5">Budget</span>
                      </div>
                      
                      <div className="divide-y divide-white/5 space-y-1.5 pt-1">
                        {categories.filter(c => c.id !== 'cat_business_expense' && !c.id.startsWith('SAVINGS_')).map((cat) => {
                          const isBusiness = cat.id === 'cat_business_expense';
                          return (
                            <div key={cat.id} className="flex items-center justify-between pt-1.5 first:pt-0 group">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`p-1.5 rounded-lg ${cat.color} scale-90 shrink-0`}>
                                  {renderCategoryIcon(cat.icon, 11)}
                                </span>
                                {editingItemId === cat.id ? (
                                  <input 
                                    type="text"
                                    value={editingItemValue}
                                    onChange={(e) => setEditingItemValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (editingItemValue.trim()) {
                                          if (isDuplicateName(editingItemValue, 'category', cat.id)) {
                                            alert(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                            setEditingItemId(null);
                                            return;
                                          }
                                          handleUpdateCategory({ ...cat, name: editingItemValue.trim() });
                                        }
                                        setEditingItemId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingItemId(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      if (editingItemValue.trim() && editingItemValue.trim() !== cat.name) {
                                        if (isDuplicateName(editingItemValue, 'category', cat.id)) {
                                          alert(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                          setEditingItemId(null);
                                          return;
                                        }
                                        handleUpdateCategory({ ...cat, name: editingItemValue.trim() });
                                      }
                                      setEditingItemId(null);
                                    }}
                                    className="px-2 py-0.5 bg-black/60 border border-amber-500/30 text-xs text-white rounded-lg outline-none w-32 font-medium font-sans"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`text-xs font-medium truncate ${cat.isHidden ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                                      {cat.name}
                                    </span>
                                    {cat.isHidden && (
                                      <span className="text-[7.5px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded font-mono font-bold uppercase shrink-0">
                                        Hidden
                                      </span>
                                    )}
                                    {isBusiness && (
                                      <span className="text-[7.5px] bg-slate-500/20 text-slate-400 ml-1.5 px-1 rounded font-mono font-bold uppercase shrink-0">
                                        Tax Deductible
                                      </span>
                                    )}
                                    <button 
                                      onClick={() => {
                                        setEditingItemId(cat.id);
                                        setEditingItemValue(cat.name);
                                      }}
                                      className="p-0.5 text-gray-500 hover:text-amber-400 transition-all cursor-pointer rounded shrink-0"
                                      title="Edit Name"
                                    >
                                      <Pencil size={10} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <DirectAmountInput 
                                  initialValue={cat.limit || 0}
                                  onUpdate={(val) => handleUpdateCategory({ ...cat, limit: val })}
                                  currencySymbol={currencySymbol}
                                  className="w-28 pl-4.5 pr-2 py-1 bg-black/40 border border-white/10 focus:border-amber-500/50 outline-none rounded-lg text-[11px] font-mono text-right font-bold text-white transition-all"
                                />
                                {!isBusiness && (
                                  <button 
                                    onClick={() => handleUpdateCategory({ ...cat, isHidden: !cat.isHidden })}
                                    className={`p-1 rounded-lg border transition-all cursor-pointer ${
                                      cat.isHidden 
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                                    title={cat.isHidden ? 'Unhide category' : 'Hide category'}
                                  >
                                    {cat.isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Custom Daily Spending Category Mini Form */}
                      <form onSubmit={handleAddDiscretionaryCategory} className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                        <input 
                          type="text"
                          placeholder="Add Custom Daily Spending Category"
                          value={newDiscretionaryName}
                          onChange={(e) => {
                            setNewDiscretionaryName(e.target.value);
                            setFormErrors(prev => ({ ...prev, category: null }));
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 bg-black/40 border border-emerald-500/30 focus:border-emerald-500/60 outline-none rounded-lg text-[10px] text-emerald-400 placeholder:text-emerald-400 font-medium font-sans placeholder:opacity-100"
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-emerald-500 font-bold">{currencySymbol}</span>
                          <input 
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={newDiscretionaryLimit}
                            onChange={(e) => {
                              setNewDiscretionaryLimit(e.target.value);
                              setFormErrors(prev => ({ ...prev, category: null }));
                            }}
                            className="w-24 pl-4.5 pr-1.5 py-1.5 bg-black/40 border border-emerald-500/20 focus:border-emerald-500/50 outline-none rounded-lg text-[10px] text-emerald-400 font-mono text-right font-bold"
                          />
                        </div>
                        <button 
                          type="submit"
                          className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title="Add Category"
                        >
                          <Plus size={13} className="stroke-[2.5]" />
                        </button>
                      </form>
                      {formErrors.category && (
                        <p className="text-[9px] text-rose-400 font-bold mt-1.5 text-left bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 animate-pulse">{formErrors.category}</p>
                      )}
                    </div>
                  )}
                </div>



              </div>
            );
          })()}



          {/* TAB 6: HELP GUIDE */}
          {activeTab === 'help' && (
            <div className="space-y-3">
              <HelpSection
                setActiveTab={setActiveTab}
                onOpenSubscriptionModal={() => setShowSubscriptionModal(true)}
                onOpenAuthModal={() => setShowAuthModal(true)}
                user={currentUser}
                subscriptionState={subscriptionState}
              />
            </div>
          )}

          {/* TAB 7: SAVINGS GOALS (DEDICATED VIEW) */}
          {activeTab === 'savings' && (() => {
            const safeSavingsGoals = Array.isArray(savingsGoals) ? savingsGoals : [];
            const activeSavingsGoals = safeSavingsGoals.filter(g => !g.isHidden);
            const hiddenSavingsGoals = safeSavingsGoals.filter(g => g.isHidden);

            const totalSavedAmt = activeSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.currentAmount as any) || 0), 0);
            const totalTargetAmt = activeSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.targetAmount as any) || 0), 0);
            const overallSavingsPercent = totalTargetAmt > 0 ? Math.min(100, Math.round((totalSavedAmt / totalTargetAmt) * 100)) : 0;
            const totalAllocationPercent = activeSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.allocationPercent as any) || 0), 0);

            return (
              <div className="space-y-4 animate-in fade-in duration-200" id="tab_savings">
                {/* Visual Header / Dashboard summary card */}
                <div className="bg-[#111111] rounded-2xl p-4 border border-white/5 relative overflow-hidden shadow-md">
                  <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-[0.03] select-none pointer-events-none">
                    <PiggyBank size={140} className="text-pink-400" />
                  </div>
                  
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="p-1.5 bg-pink-500/15 border border-pink-500/25 rounded-xl text-pink-400">
                      <PiggyBank size={18} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[#eeeeee] text-xs uppercase tracking-wider">Savings Dashboard</h3>
                      <p className="text-[9px] text-gray-400 mt-0.5">Emergency funds, investing & milestones</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-left">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total Saved</span>
                      <span className="text-base font-extrabold text-pink-400 tnum block">{currencySymbol}{totalSavedAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="block text-[10.5px] text-gray-400 mt-1">Target: {currencySymbol}{totalTargetAmt.toLocaleString()} ({overallSavingsPercent}%)</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-left">
                      <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Combined Allocations</span>
                      <span className={`text-base font-extrabold tnum block ${totalAllocationPercent === 100 ? "text-emerald-400" : "text-rose-400"}`}>{totalAllocationPercent}%</span>
                      <span className="block text-[10.5px] text-gray-400 mt-1">
                        {totalAllocationPercent === 100 ? "✅ Balanced" : "⚠️ Must equal 100%"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Conceptual Clarification Card */}
                <div className="bg-[#111111] rounded-2xl p-3.5 border border-white/5 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={11} className="text-pink-400" />
                    <span className="text-[9px] font-black text-pink-400 uppercase tracking-wider">How savings work</span>
                  </div>
                  <p className="text-[9.5px] text-gray-300 font-medium leading-normal">
                    Unlike the Monthly Budget which sets strict spend limits, Savings are funded dynamically through your **End-of-Month Account Reconciliation** 🔄.
                  </p>
                  <p className="text-[9px] text-gray-400 leading-normal font-sans">
                    When you reconcile your real chequing/savings accounts at month-end, any actual cash surplus will be distributed across these active targets using their allocation percentage.
                  </p>
                  <div className="pt-1.5">
                    <button
                      onClick={() => {
                        setReconciliationStep(1);
                        setShowReconciliationModal(true);
                      }}
                      className="w-full py-2 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/20 text-pink-400 font-extrabold uppercase tracking-widest text-[9px] rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw size={11} className="stroke-[2.5]" /> Run Monthly Reconciliation Now
                    </button>
                  </div>
                </div>

                {/* Savings Goals List */}
                <div className="bg-[#111111] rounded-2xl border border-white/5 p-3.5 text-left space-y-3.5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#eeeeee] text-[11px] uppercase tracking-wider">Active Targets</span>
                      <span className="text-[8px] bg-pink-500/10 text-pink-400 border border-pink-500/15 font-bold px-1.5 py-0.2 rounded font-mono">
                        {activeSavingsGoals.length} GOALS
                      </span>
                    </div>
                  </div>

                  {savingsGoalError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start justify-between gap-2 shadow-md animate-in fade-in duration-150">
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-snug font-medium text-rose-200">{savingsGoalError}</div>
                      </div>
                      <button 
                        onClick={() => setSavingsGoalError(null)} 
                        className="text-rose-400 hover:text-rose-100 p-1 rounded-lg hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer"
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {activeSavingsGoals.length === 0 ? (
                    <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 text-center text-gray-400 text-xs space-y-1">
                      <PiggyBank size={28} className="mx-auto text-pink-400/50 mb-1" />
                      <p className="font-bold text-gray-300">No Active Savings Goals</p>
                      <p className="text-[10px] text-gray-500">Create a new savings goal below or restore hidden goals.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeSavingsGoals.map((item, index) => {
                        const curAmt = parseFloat(item.currentAmount as any) || 0;
                        const tgtAmt = parseFloat(item.targetAmount as any) || 0;
                        const percentSaved = tgtAmt > 0 ? Math.min(100, Math.round((curAmt / tgtAmt) * 100)) : 0;
                        const isEven = index % 2 === 0;
                        return (
                          <div 
                            key={item.id} 
                            className={`p-2.5 px-3 rounded-xl flex flex-col gap-2 border transition-all duration-200 group ${
                              isEven 
                                ? 'bg-slate-900/95 border-slate-800 hover:bg-slate-900 hover:border-slate-700' 
                                : 'bg-pink-950/10 border-pink-500/10 hover:bg-pink-950/15 hover:border-pink-500/20'
                            }`}
                          >
                            {/* Line 1: Goal name and actions (full-width header) */}
                            <div className="flex items-center justify-between w-full border-b border-white/[0.04] pb-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {editingItemId === item.id ? (
                                  <input 
                                    type="text"
                                    value={editingItemValue}
                                    onChange={(e) => setEditingItemValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        if (editingItemValue.trim()) {
                                          if (isDuplicateName(editingItemValue, 'savings', item.id)) {
                                            setSavingsGoalError(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                            setEditingItemId(null);
                                            return;
                                          }
                                          handleUpdateSavingsGoal(item.id, { label: editingItemValue.trim() });
                                        }
                                        setEditingItemId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingItemId(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      if (editingItemValue.trim()) {
                                        if (isDuplicateName(editingItemValue, 'savings', item.id)) {
                                          setSavingsGoalError(`The name "${editingItemValue.trim()}" is already in use in another section or category. Please choose a unique name.`);
                                          setEditingItemId(null);
                                          return;
                                        }
                                        handleUpdateSavingsGoal(item.id, { label: editingItemValue.trim() });
                                      }
                                      setEditingItemId(null);
                                    }}
                                    className="px-2 py-1 bg-black/60 border border-pink-500/30 text-xs text-white rounded-lg outline-none w-32 font-medium font-sans"
                                    autoFocus
                                  />
                                ) : (
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs font-extrabold truncate max-w-[130px] sm:max-w-[200px] text-white" title={item.label}>
                                      {item.label}
                                    </span>
                                    <button 
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditingItemValue(item.label);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-pink-400 transition-all cursor-pointer rounded-lg shrink-0 hover:bg-white/5 border-0"
                                      title="Edit Name"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2.5 py-1 rounded-lg font-bold tnum">
                                  {percentSaved}% Saved
                                </span>
                                <button 
                                  onClick={() => handleUpdateSavingsGoal(item.id, { isHidden: true })}
                                  className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 transition-all cursor-pointer active:scale-95"
                                  title="Hide Savings Goal (Target, Saved, and Allocation % must be 0)"
                                >
                                  <EyeOff size={16} />
                                </button>
                                <button 
                                  onClick={() => setItemToDelete({ id: item.id, name: item.label, type: 'savings' })}
                                  className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-all cursor-pointer active:scale-95"
                                  title="Delete Savings Goal"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Line 2: Three adjustable value fields stacked vertically with names above */}
                            <div className="grid grid-cols-3 gap-2.5 w-full pt-1.5">
                              {/* Desired target input */}
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide pl-0.5">Target</span>
                                <DirectAmountInput 
                                  initialValue={parseFloat(item.targetAmount as any) || 0}
                                  onUpdate={(val) => handleUpdateSavingsGoal(item.id, { targetAmount: val })}
                                  currencySymbol={currencySymbol}
                                  className="w-full pl-5 pr-1.5 py-2 bg-black/45 border border-white/5 focus:border-pink-500/50 outline-none rounded-lg text-sm tnum text-left font-bold text-white transition-colors focus:bg-black/60"
                                />
                              </div>

                              {/* Current saved amount input (Editable - allow moving funds between goals) */}
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide pl-0.5">Saved</span>
                                <DirectAmountInput 
                                  initialValue={curAmt}
                                  onUpdate={(val) => handleUpdateSavingsGoal(item.id, { currentAmount: Math.max(0, val) })}
                                  currencySymbol={currencySymbol}
                                  className="w-full pl-5 pr-1.5 py-2 bg-black/45 border border-white/5 focus:border-pink-500/50 outline-none rounded-lg text-sm tnum text-left font-extrabold text-pink-300 transition-colors focus:bg-black/60"
                                />
                              </div>

                              {/* Allocation percent input */}
                              <div className="flex flex-col gap-1 text-left">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide pl-0.5">Alloc</span>
                                <DirectAmountInput 
                                  initialValue={parseFloat(item.allocationPercent as any) || 0}
                                  onUpdate={(val) => {
                                    let finalVal = val;
                                    if (finalVal < 0) {
                                      alert("Allocation percentage cannot be negative.");
                                      finalVal = Math.max(0, parseFloat(item.allocationPercent as any) || 0);
                                    }
                                    if (item.id === 'emergency_fund' && finalVal > 0 && finalVal < 10) {
                                      alert("The Reserve goal must have a minimum allocation percentage of 10% (or 0% to disable).");
                                      finalVal = 10;
                                    }
                                    handleUpdateSavingsGoal(item.id, { allocationPercent: finalVal });
                                  }}
                                  isPercent={true}
                                  max={100}
                                  className="w-full pl-2 pr-5 py-2 bg-black/45 border border-white/5 focus:border-pink-500/50 outline-none rounded-lg text-sm tnum text-left font-bold text-white transition-colors focus:bg-black/60"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Collapsible Hidden Goals Section */}
                  {hiddenSavingsGoals.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setShowHiddenSavingsGoals(prev => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-[10px] font-bold text-gray-400 hover:text-gray-200 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <EyeOff size={13} className="text-gray-500" />
                          <span>Hidden Savings Goals ({hiddenSavingsGoals.length})</span>
                        </div>
                        <span className="text-[9px] text-gray-500 flex items-center gap-1">
                          {showHiddenSavingsGoals ? 'Collapse' : 'Expand'}
                          <ChevronDown size={12} className={`transition-transform duration-200 ${showHiddenSavingsGoals ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {showHiddenSavingsGoals && (
                        <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
                          {hiddenSavingsGoals.map(item => (
                            <div 
                              key={item.id} 
                              className="p-2 px-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-gray-400 line-through truncate">{item.label}</span>
                                <span className="text-[8px] bg-white/5 text-gray-400 border border-white/10 px-1.5 py-0.2 rounded font-mono uppercase">
                                  Hidden
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSavingsGoal(item.id, { isHidden: false })}
                                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                  title="Restore / Unhide Goal"
                                >
                                  <Eye size={12} />
                                  <span>Unhide</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setItemToDelete({ id: item.id, name: item.label, type: 'savings' })}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                  title="Delete permanently"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    if (activeSavingsGoals.length > 0 && totalAllocationPercent !== 100) {
                      return (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] rounded-xl leading-normal text-left font-sans flex items-start gap-1.5 mt-1">
                          <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-400" />
                          <div>
                            <span className="font-bold block text-rose-200">Combined Allocation must equal 100% (currently: {totalAllocationPercent}%)</span>
                            Please adjust the percentages of your active goals until their sum is exactly 100%.
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Add Custom Savings Goal Mini Form */}
                  <form onSubmit={handleAddSavingsGoal} className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2.5">
                    <p className="text-[9.5px] font-extrabold text-pink-400 uppercase tracking-widest flex items-center gap-1">
                      <Plus size={11} /> Create New Savings Goal
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="space-y-1 col-span-2">
                        <label className="text-[7.5px] text-gray-500 uppercase tracking-wider font-bold">Goal Name</label>
                        <input 
                          type="text"
                          placeholder="e.g. Dream Home, New Car"
                          value={newSavingsName}
                          onChange={(e) => {
                            setNewSavingsName(e.target.value);
                            setFormErrors(prev => ({ ...prev, savings: null }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-[#121212] border border-pink-500/30 focus:border-pink-500/60 outline-none rounded-lg text-[10px] text-pink-400 placeholder:text-pink-400/40 font-medium font-sans"
                          required
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[7.5px] text-gray-500 uppercase tracking-wider font-bold">Target Saved Amt</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-pink-400 font-bold">{currencySymbol}</span>
                          <input 
                            type="number"
                            placeholder="5000"
                            min="0"
                            step="0.01"
                            value={newSavingsTarget}
                            onChange={(e) => {
                              setNewSavingsTarget(e.target.value);
                              setFormErrors(prev => ({ ...prev, savings: null }));
                            }}
                            className="w-full pl-5 pr-1.5 py-1.5 bg-[#121212] border border-pink-500/20 focus:border-pink-500/50 outline-none rounded-lg text-[10px] text-pink-400 font-mono text-left font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[7.5px] text-gray-500 uppercase tracking-wider font-bold">Allocation %</label>
                        <div className="relative">
                          <input 
                            type="number"
                            placeholder="25"
                            min="0"
                            max="100"
                            step="0.01"
                            value={newSavingsPercent}
                            onChange={(e) => {
                              setNewSavingsPercent(e.target.value);
                              setFormErrors(prev => ({ ...prev, savings: null }));
                            }}
                            className="w-full pl-2.5 pr-5 py-1.5 bg-[#121212] border border-pink-500/20 focus:border-pink-500/50 outline-none rounded-lg text-[10px] text-pink-400 font-mono text-left font-bold"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-pink-400 font-bold">%</span>
                        </div>
                      </div>
                    </div>

                    {formErrors.savings && (
                      <p className="text-[9px] text-rose-400 font-bold mt-1 text-left bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1 animate-pulse">{formErrors.savings}</p>
                    )}

                    <button 
                      type="submit"
                      className="w-full py-2 bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/20 text-pink-400 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Plus size={12} className="stroke-[2.5]" /> Add Savings Goal
                    </button>
                  </form>
                </div>
              </div>
            );
          })()}

        </div>

        {/* Dynamic bottom floating CTA trigger for quick accessibility */}
        {activeTab !== 'budget_plan' && activeTab !== 'dev_hub' && activeTab !== 'help' && activeTab !== 'budget_full' && (
          <div className="absolute right-5 bottom-18 z-20">
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center border-0 outline-hidden focus:ring-4 focus:ring-emerald-500/20"
              title="Add Daily Spending Expense"
            >
              <Plus size={22} className="stroke-[3]" />
            </button>
          </div>
        )}





        {/* Modern Bottom Android Navigation Tab bar */}
        <div className="bg-[#0A0A0A] border-t border-white/10 px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] shrink-0 flex items-center justify-between z-30 relative sticky bottom-0 w-full" id="android_nav_bar">
          
          {/* Nav Item: Dashboard */}
          <button
            onClick={() => { setActiveTab('dashboard'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'dashboard' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <LayoutDashboard size={18} className={activeTab === 'dashboard' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">Daily</span>
          </button>

          {/* Nav Item: Logs history */}
          <button
            onClick={() => { setActiveTab('history'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'history' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <History size={18} className={activeTab === 'history' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">History</span>
          </button>

          {/* Nav Item: Trends & Charts */}
          <button
            onClick={() => { setActiveTab('analytics'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'analytics' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <PieChart size={18} className={activeTab === 'analytics' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">Insights</span>
          </button>

          {/* Nav Item: Full Budget */}
          <button
            onClick={() => { setActiveTab('budget_full'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'budget_full' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <Wallet size={18} className={activeTab === 'budget_full' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">Budget</span>
          </button>

          {/* Nav Item: Savings Goals */}
          <button
            onClick={() => { setActiveTab('savings'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'savings' ? 'text-pink-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <PiggyBank size={18} className={activeTab === 'savings' ? 'stroke-[2.5] text-pink-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">Savings</span>
          </button>

          {/* Nav Item: Local SQLite/Budget settings */}
          <button
            onClick={() => { setActiveTab('budget_plan'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'budget_plan' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <Sliders size={18} className={activeTab === 'budget_plan' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">Settings</span>
          </button>

          {/* Nav Item: Help & Guide */}
          <button
            onClick={() => { setActiveTab('help'); setShowAddForm(false); }}
            className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
              activeTab === 'help' ? 'text-emerald-400 scale-105 font-bold' : 'text-slate-300 hover:text-white font-medium'
            }`}
          >
            <HelpCircle size={18} className={activeTab === 'help' ? 'stroke-[2.5] text-emerald-400' : 'stroke-[2] text-slate-300'} />
            <span className="text-[9px] mt-0.5 font-sans tracking-tight">Help</span>
          </button>

        </div>
      </div>

      {/* Robust PWA Install Guide Modal rendered outside of any parent transforms or clipping contexts via React Portal */}
      {showPwaGuide && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 text-slate-200 font-sans">
            <button
              onClick={() => setShowPwaGuide(false)}
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
                  <li>Click the <strong className="text-white font-semibold">Install icon</strong> (small monitor with download arrow) inside the URL address bar.</li>
                  <li>Or open settings menu (3 dots) and click <strong className="text-white font-semibold">Save and share → Install app</strong>.</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-[#161616] p-2.5 border border-white/5 rounded-xl">
                <CheckCircle size={14} className="text-emerald-400 shrink-0 animate-pulse" />
                <span>Stand-alone PWA apps consume near-zero memory, loads instantly offline, and can be easily uninstalled at any time.</span>
              </div>
            </div>

            <button
              onClick={() => setShowPwaGuide(false)}
              className="mt-5 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer border-0 active:scale-95 text-center font-sans"
            >
              Got It
            </button>
          </div>
        </div>,
        document.body
      )}

      {itemToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 max-w-xs w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <Trash2 size={20} />
              </div>
              <h3 className="font-bold text-sm tracking-tight text-white">Confirm Deletion</h3>
            </div>
            
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Are you sure you want to delete <span className="text-white font-bold">"{itemToDelete.name}"</span>? 
              This will remove it from your budget planner list. Historical data in previous months will remain intact.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border-0 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (itemToDelete.type === 'income') {
                    handleDeleteIncomeStream(itemToDelete.id);
                  } else if (itemToDelete.type === 'fixed') {
                    handleDeleteFixedExpense(itemToDelete.id);
                  } else if (itemToDelete.type === 'savings') {
                    handleDeleteSavingsGoal(itemToDelete.id);
                  } else if (itemToDelete.type === 'category') {
                    handleDeleteCategory(itemToDelete.id);
                  }
                  setItemToDelete(null);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold border-0 cursor-pointer transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCategoryManager && createPortal(
        <CategoryManager
          categories={categories}
          fixedExpenses={fixedExpenses}
          currentBudget={currentBudget}
          onCategoryAdded={handleAddCategory}
          onCategoryUpdated={handleUpdateCategory}
          onCategoryDeleted={handleDeleteCategory}
          onFixedExpenseUpdated={handleUpdateFixedExpense}
          onSavingsGoalUpdated={handleUpdateSavingsGoal}
          defaultCategoryId={defaultCategoryId}
          currencySymbol={currencySymbol}
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
        />,
        document.body
      )}

      {showReconciliationModal && createPortal(
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-slate-200 font-sans">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-950/20 border border-emerald-500/20 text-[#10b981] rounded-xl flex items-center justify-center">
                  <RefreshCw size={15} className="animate-spin-slow" />
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-white text-xs uppercase tracking-wider">Surplus Allocation Tool</h3>
                  <p className="text-[8px] text-gray-400 font-mono uppercase tracking-widest mt-0.5">Reconciliation • Step {reconciliationStep} of 3</p>
                </div>
              </div>
              <button
                onClick={() => setShowReconciliationModal(false)}
                className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg cursor-pointer border-0 bg-transparent flex items-center justify-center"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Steps indicator bar */}
            <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex items-center justify-between shrink-0">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    reconciliationStep === step 
                      ? 'bg-emerald-500 text-black font-extrabold'
                      : reconciliationStep > step
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    reconciliationStep === step ? 'text-emerald-400' : 'text-gray-500'
                  }`}>
                    {step === 1 ? 'Cash Balances' : step === 2 ? 'Surplus Calculation' : 'Goal Distribution'}
                  </span>
                  {step < 3 && <span className="text-gray-600">/</span>}
                </div>
              ))}
            </div>

            {/* Scrollable Content Area */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-left">
              {reconciliationStep === 1 && (
                <div className="space-y-3.5">
                  {!hasEnteredBudgetData && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                      <p className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                        <AlertCircle size={12} /> No Budget Data Entered
                      </p>
                      <p className="text-[9.5px] text-gray-300 leading-normal">
                        You haven't entered any budget limits, income streams, fixed expenses, or transactions yet. Please configure your budget data in the Budget Plan tab first before running account reconciliation.
                      </p>
                    </div>
                  )}
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1">
                    <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
                      Enter cash balances
                    </p>
                    <p className="text-[9px] text-gray-400 leading-normal">
                      Please enter your actual cash balances across your liquid accounts as of the last day of {getPreviousMonthName()}.
                    </p>
                  </div>

                  {/* Chequing Account */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-gray-400 uppercase tracking-wider font-bold block">Chequing Accounts Balance</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">{currencySymbol}</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        min="0"
                        value={chequingBalance}
                        onChange={(e) => setChequingBalance(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-[#1c1c1c] border border-white/10 focus:border-emerald-500/50 outline-none rounded-xl text-xs font-mono font-bold text-white text-left placeholder:text-gray-600"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Savings Account */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-gray-400 uppercase tracking-wider font-bold block">Liquid Savings Accounts Balance</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">{currencySymbol}</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        min="0"
                        value={savingsBalance}
                        onChange={(e) => setSavingsBalance(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-[#1c1c1c] border border-white/10 focus:border-emerald-500/50 outline-none rounded-xl text-xs font-mono font-bold text-white text-left placeholder:text-gray-600"
                        required
                      />
                    </div>
                  </div>

                  {/* Cash on Hand */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-gray-400 uppercase tracking-wider font-bold block">Physical Cash on Hand</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">{currencySymbol}</span>
                      <input 
                        type="number"
                        placeholder="0.00"
                        min="0"
                        value={cashOnHand}
                        onChange={(e) => setCashOnHand(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 bg-[#1c1c1c] border border-white/10 focus:border-emerald-500/50 outline-none rounded-xl text-xs font-mono font-bold text-white text-left placeholder:text-gray-600"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {reconciliationStep === 2 && (() => {
                const chequingVal = parseFloat(chequingBalance) || 0;
                const savingsVal = parseFloat(savingsBalance) || 0;
                const cashVal = parseFloat(cashOnHand) || 0;
                const balancesTotal = chequingVal + savingsVal + cashVal;

                // Calculate actual unallocated liquid cash currently in bank vs existing goal reserves
                const existingSavingsTotal = tempSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.currentAmount as any) || 0), 0);
                const reconciledSurplus = balancesTotal - existingSavingsTotal;

                return (
                  <div className="space-y-4">
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-1">
                      <p className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
                        Reconciled surplus available
                      </p>
                      <p className="text-[9px] text-gray-400 leading-normal">
                        Here is the calculation to derive the reconciled available surplus to distribute to your savings goals.
                      </p>
                    </div>

                    <div className="p-3.5 bg-[#181818] border border-white/5 rounded-2xl space-y-2.5 font-mono text-xs">
                      {/* Sub-balances breakdown */}
                      <div className="flex justify-between items-center text-gray-400 border-b border-white/5 pb-1.5">
                        <span className="font-sans text-[10px] font-bold uppercase text-gray-500">Liquidity Subtotal</span>
                        <span className="font-extrabold text-white">{currencySymbol}{balancesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      
                      <div className="pl-3 space-y-1 border-l border-white/5 text-[11px] text-gray-400">
                        <div className="flex justify-between items-center">
                          <span>Chequing balances:</span>
                          <span>{currencySymbol}{chequingVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Savings balances:</span>
                          <span>{currencySymbol}{savingsVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Cash on hand:</span>
                          <span>{currencySymbol}{cashVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>

                      {/* Calculation Rows */}
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <div className="flex justify-between items-center text-[#eeeeee]">
                          <span className="flex items-center gap-1.5 font-sans">
                            <span className="text-emerald-500 font-bold">+</span> Total Verified Bank & Cash Balances:
                          </span>
                          <span className="font-bold">{currencySymbol}{balancesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex justify-between items-center text-amber-400">
                          <span className="flex items-center gap-1.5 font-sans">
                            <span className="text-amber-500 font-bold">-</span> Existing Savings Goal Reserves:
                          </span>
                          <span className="font-bold">{currencySymbol}{existingSavingsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        <div className="p-2.5 bg-white/5 rounded-xl border border-white/5 text-[9.5px] font-sans text-gray-400 leading-relaxed">
                          ℹ️ <strong>Actual Cash Reconciliation:</strong> Calculates actual liquid surplus sitting in your bank right now that hasn't been earmarked for a savings goal yet. No unearned future income or estimated future expenses are assumed.
                        </div>
                      </div>

                      {/* Calculated Surplus Summary block */}
                      <div className={`p-3 rounded-xl border flex flex-col items-center justify-center mt-3 text-center ${
                        reconciledSurplus >= 0
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-550/10 border-rose-500/20 text-rose-400'
                      }`}>
                        <span className="text-[8px] font-black uppercase tracking-widest font-sans">
                          {reconciledSurplus >= 0 ? 'RECONCILED SURPLUS' : 'RECONCILED DEFICIT'}
                        </span>
                        <span className="text-xl font-black font-mono mt-1">
                          {currencySymbol}{reconciledSurplus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[8px] font-sans text-gray-400 mt-1 uppercase tracking-wider">
                          {reconciledSurplus >= 0 
                            ? 'Unallocated cash ready to distribute into Savings targets!'
                            : 'Adjust goal amounts or deposit funds to reconcile account balance.'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {reconciliationStep === 3 && (() => {
                const chequingVal = parseFloat(chequingBalance) || 0;
                const savingsVal = parseFloat(savingsBalance) || 0;
                const cashVal = parseFloat(cashOnHand) || 0;
                const balancesTotal = chequingVal + savingsVal + cashVal;

                // Subtract existing accumulated savings across goals to avoid double-counting
                const existingSavingsTotal = tempSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.currentAmount as any) || 0), 0);
                const reconciledSurplus = balancesTotal - existingSavingsTotal;

                if (tempSavingsGoals.length === 0) {
                  return (
                    <div className="space-y-4 text-center py-4">
                      <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
                        <AlertCircle size={24} />
                      </div>
                      <div className="space-y-1 max-w-xs mx-auto">
                        <h4 className="font-extrabold text-white text-sm uppercase tracking-wider">No Savings Goals Set</h4>
                        <p className="text-[10.5px] text-gray-400 leading-relaxed">
                          You do not have any active Savings Goals to receive your reconciled amount of <strong className={reconciledSurplus >= 0 ? "text-emerald-400" : "text-rose-400"}>{currencySymbol}{reconciledSurplus.toLocaleString()}</strong>.
                        </p>
                        <p className="text-[9.5px] text-gray-500 leading-normal pt-2">
                          Please exit the reconciliation flow, add a custom savings goal with its desired allocation percent, and run this process again.
                        </p>
                      </div>
                    </div>
                  );
                }

                const totalAllocatedPercent = tempSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.allocationPercent) || 0), 0);
                const isOverAllocated = totalAllocatedPercent > 100;
                const bufferPercent = Math.max(0, 100 - totalAllocatedPercent);
                const bufferAmount = reconciledSurplus * (bufferPercent / 100);

                return (
                  <div className="space-y-3.5">
                    <div className={`p-3 rounded-xl space-y-1 ${reconciledSurplus >= 0 ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-rose-500/5 border border-rose-500/10'}`}>
                      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${reconciledSurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {reconciledSurplus >= 0 
                          ? `Distribute ${currencySymbol}${reconciledSurplus.toLocaleString()} surplus` 
                          : `Distribute ${currencySymbol}${Math.abs(reconciledSurplus).toLocaleString()} deficit`
                        }
                      </p>
                      <p className="text-[9px] text-gray-400 leading-normal">
                        {reconciledSurplus >= 0 
                          ? "Modify allocation percentages to control what portion of this month's surplus is directed to each goal."
                          : "Modify allocation percentages to control how this month's deficit is subtracted from each goal."
                        }
                      </p>
                    </div>

                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                      {tempSavingsGoals.map((item) => {
                        const currentPercent = parseFloat(item.allocationPercent) || 0;
                        const allocatedPortion = reconciledSurplus * (currentPercent / 100);
                        const updatedAmount = Math.round((((item.currentAmount || 0) + allocatedPortion) + Number.EPSILON) * 100) / 100;
                        const percentSaved = (item.targetAmount || 0) > 0 ? Math.min(100, Math.max(0, Math.round((updatedAmount / (item.targetAmount || 0)) * 100))) : 0;

                        return (
                          <div key={item.id} className="p-2.5 bg-black/40 border border-white/5 rounded-xl space-y-2">
                             <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-[#eeeeee]">{item.label}</span>
                              <div className="flex items-center gap-1.5">
                                <label className="text-[8px] text-gray-500 uppercase font-black">Allocation</label>
                                <div className="relative">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={item.allocationPercent}
                                    onChange={(e) => {
                                      const rawVal = parseFloat(e.target.value) || 0;
                                      let val = Math.max(0, Math.min(100, rawVal));
                                      
                                      setTempSavingsGoals(prev => prev.map(x => {
                                        if (x.id === item.id) {
                                          let finalVal = val;
                                          if (x.id === 'emergency_fund' && finalVal > 0 && finalVal < 10) {
                                            finalVal = 10;
                                          }
                                          return { ...x, allocationPercent: finalVal };
                                        }
                                        return x;
                                      }));
                                    }}
                                    className={`w-14 pl-1.5 pr-4 py-0.5 bg-[#121212] border border-white/10 focus:border-emerald-500/50 outline-none rounded text-[10px] font-mono text-left font-bold ${
                                      reconciledSurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 font-bold">%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[9.5px] font-mono text-gray-400 pt-1 border-t border-white/5">
                              <div>
                                <span>Portion: </span>
                                {reconciledSurplus >= 0 ? (
                                  <strong className="text-emerald-400">+{currencySymbol}{allocatedPortion.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                ) : (
                                  <strong className="text-rose-400">-{currencySymbol}{Math.abs(allocatedPortion).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                )}
                              </div>
                              <div>
                                <span>Balances: </span>
                                <span className="text-gray-300">
                                  {currencySymbol}{(item.currentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → <strong className="text-white font-extrabold">{currencySymbol}{updatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                </span>
                              </div>
                            </div>

                            {/* Mini progress preview */}
                            <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                              <div 
                                className={`h-1 rounded-full transition-all ${reconciledSurplus >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                style={{ width: `${percentSaved}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Allocation validation bar */}
                    {(() => {
                      const isAllocationInvalid = tempSavingsGoals.length > 0 ? (totalAllocatedPercent !== 100) : false;

                      return (
                        <div className={`p-2.5 rounded-xl border text-[9.5px] leading-relaxed space-y-1 ${
                          isAllocationInvalid
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          <div className="flex justify-between font-bold">
                            <span>Total Allocation Percentage:</span>
                            <span>{totalAllocatedPercent}% / 100%</span>
                          </div>
                          {isAllocationInvalid ? (
                            <p className="text-gray-400 font-medium font-sans">
                              {totalAllocatedPercent < 100 
                                ? "⚠️ Combined allocation percentage must equal exactly 100%. Please increase percentages of your savings goals."
                                : "⚠️ Combined allocation percentage must equal exactly 100%. Please decrease percentages of your savings goals."
                              }
                            </p>
                          ) : (
                            <p className="text-gray-400 font-medium font-sans">
                              {reconciledSurplus >= 0 ? (
                                <>✅ Perfectly matched! 100% of the reconciled surplus will be distributed fully to your savings goals.</>
                              ) : (
                                <>✅ Perfectly matched! 100% of the reconciled deficit will be subtracted fully from your savings goals.</>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 border-t border-white/5 bg-[#151515] rounded-b-2xl flex gap-2.5 shrink-0 justify-between items-center">
              <div>
                {reconciliationStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setReconciliationStep(prev => prev - 1)}
                    className="py-2 px-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border-0 active:scale-95"
                  >
                    <ArrowLeft size={12} /> Back
                  </button>
                )}
              </div>

              <div>
                {reconciliationStep === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasEnteredBudgetData) {
                        alert("Please set up your budget data (category limits, income, or fixed expenses) first before running account reconciliation.");
                        return;
                      }
                      if (!chequingBalance || !savingsBalance || !cashOnHand) {
                        alert("Please fill in all balance values to proceed.");
                        return;
                      }
                      setReconciliationStep(2);
                    }}
                    disabled={!hasEnteredBudgetData}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-0 active:scale-95"
                  >
                    Calculate Surplus <ArrowRight size={12} />
                  </button>
                )}

                {reconciliationStep === 2 && (() => {
                  const chequingVal = parseFloat(chequingBalance) || 0;
                  const savingsVal = parseFloat(savingsBalance) || 0;
                  const cashVal = parseFloat(cashOnHand) || 0;
                  const balancesTotal = chequingVal + savingsVal + cashVal;

                  const existingSavingsTotal = tempSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.currentAmount as any) || 0), 0);
                  const reconciledSurplus = balancesTotal - existingSavingsTotal;

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setReconciliationStep(3);
                      }}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-0 active:scale-95"
                    >
                      {reconciledSurplus >= 0 ? 'Proceed to Allocation' : 'Proceed to Deficit Allocation'} <ArrowRight size={12} />
                    </button>
                  );
                })()}

                {reconciliationStep === 3 && (() => {
                  const chequingVal = parseFloat(chequingBalance) || 0;
                  const savingsVal = parseFloat(savingsBalance) || 0;
                  const cashVal = parseFloat(cashOnHand) || 0;
                  const balancesTotal = chequingVal + savingsVal + cashVal;

                  const existingSavingsTotal = tempSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.currentAmount as any) || 0), 0);
                  const reconciledSurplus = balancesTotal - existingSavingsTotal;

                  if (tempSavingsGoals.length === 0) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setShowReconciliationModal(false);
                        }}
                        className="py-2 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-0 active:scale-95"
                      >
                        Acknowledge & Close
                      </button>
                    );
                  }

                  const totalAllocatedPercent = tempSavingsGoals.reduce((sum, g) => sum + (parseFloat(g.allocationPercent) || 0), 0);
                  const isAllocationInvalid = tempSavingsGoals.length > 0 ? (totalAllocatedPercent !== 100) : false;

                  return (
                    <button
                      type="button"
                      disabled={isAllocationInvalid}
                      onClick={() => {
                        if (isAllocationInvalid) return;
                        
                        // Apply distributed amounts to actual savingsGoals with baseline tracking
                        let baselines: Record<string, number> = {};
                        if (hasRunReconciliationThisMonth) {
                          try {
                            const stored = localStorage.getItem('reconciliation_baseline_goals');
                            if (stored) baselines = JSON.parse(stored);
                          } catch (e) {}
                        } else {
                          // First run of the month: current savingsGoals are the baseline!
                          savingsGoals.forEach(g => {
                            baselines[g.id] = g.currentAmount || 0;
                          });
                          try {
                            localStorage.setItem('reconciliation_baseline_goals', JSON.stringify(baselines));
                            localStorage.setItem('last_reconciliation_month', currentReconciliationMonthKey);
                          } catch (e) {}
                        }

                        updateAndSyncSavingsGoals(prev => prev.map(originalGoal => {
                          const tempGoal = tempSavingsGoals.find(t => t.id === originalGoal.id);
                          if (!tempGoal) return originalGoal;
                          
                          const percent = parseFloat(tempGoal.allocationPercent) || 0;
                          const allocatedPortion = reconciledSurplus * (percent / 100);
                          
                          // Use the saved baseline as the starting point!
                          const baseAmount = baselines[originalGoal.id] !== undefined 
                            ? baselines[originalGoal.id] 
                            : (originalGoal.currentAmount || 0);

                          const updatedAmount = Math.round(((baseAmount + allocatedPortion) + Number.EPSILON) * 100) / 100;

                          return {
                            ...originalGoal,
                            allocationPercent: percent,
                            currentAmount: updatedAmount
                          };
                        }));

                        setShowReconciliationModal(false);
                        
                        // Soft browser Alert success
                        if (reconciledSurplus >= 0) {
                          alert(`Reconciliation Successful! Distributed ${currencySymbol}${reconciledSurplus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} surplus across your Savings Goals!`);
                        } else {
                          alert(`Reconciliation Successful! Subtracted ${currencySymbol}${Math.abs(reconciledSurplus).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} deficit from your Savings Goals!`);
                        }
                      }}
                      className={`py-2 px-4 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all border-0 ${
                        isAllocationInvalid
                          ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                          : reconciledSurplus >= 0 
                            ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 cursor-pointer'
                            : 'bg-rose-600 hover:bg-rose-500 active:scale-95 cursor-pointer'
                      }`}
                    >
                      <CheckCircle size={12} className="stroke-[2.5]" /> Approve & Apply
                    </button>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Auth & Firebase Cloud Sync Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        onDataSynced={() => loadDatabaseState(selectedMonth)}
      />

      {/* Subscription & Paywall Modal */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        subscriptionState={subscriptionState}
        onSubscriptionUpdate={(newState) => {
          setSubscriptionState(newState);
          SubscriptionManager.saveSubscriptionState(newState);
        }}
      />

      {/* Auto-Post Floating Toast Banner with Undo */}
      {autoPostToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md animate-in slide-in-from-top-4 duration-300">
          <div className="bg-[#141816] border border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl shadow-emerald-950/50 flex items-center justify-between gap-3 text-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-black uppercase text-emerald-400 tracking-wider">
                    Auto-Posted
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {currencySymbol}{autoPostToast.amount.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate">
                  {autoPostToast.vendor} <span className="text-emerald-400 font-normal">→ {autoPostToast.categoryName}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleUndoAutoPost(autoPostToast.expenseId)}
                className="px-2.5 py-1 bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 text-slate-200 border border-white/15 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setAutoPostToast(null)}
                className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border-0 bg-transparent"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Wallet Sync Hub Modal */}
      {showWalletSyncModal && (
        <WalletSyncModal
          isOpen={showWalletSyncModal}
          onClose={() => setShowWalletSyncModal(false)}
          categories={categories}
          currencySymbol={currencySymbol}
          onSimulateNotification={(text, source) => {
            handleProcessNotification(text, source);
          }}
        />
      )}

      {/* First-Time Vendor Categorization & Auto-Post Rule Setup Modal */}
      {firstTimeVendorData && (
        <FirstTimeVendorModal
          isOpen={!!firstTimeVendorData}
          vendorName={firstTimeVendorData.vendorName}
          amount={firstTimeVendorData.amount}
          currencySymbol={firstTimeVendorData.currencySymbol || currencySymbol}
          source={firstTimeVendorData.source}
          appName={firstTimeVendorData.appName}
          date={firstTimeVendorData.date}
          categories={categories}
          suggestedCategoryId={firstTimeVendorData.suggestedCategoryId}
          rawText={firstTimeVendorData.rawText}
          onConfirm={handleConfirmFirstTimeVendor}
          onClose={() => {
            if (firstTimeVendorData.notifId) {
              fetch('/api/notifications/ack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: firstTimeVendorData.notifId })
              }).catch(() => {});
            }
            setFirstTimeVendorData(null);
          }}
        />
      )}
    </AndroidFrame>
  );
}
