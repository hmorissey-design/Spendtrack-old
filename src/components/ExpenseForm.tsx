/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Category, Expense } from '../types';
import { Plus, X, Calendar, DollarSign, MessageSquare, CreditCard, Sparkles, Check, Smartphone } from 'lucide-react';
import { renderCategoryIcon } from './BudgetSettings';
import { useIsMobileDevice } from '../utils/device';

interface ExpenseFormProps {
  categories: Category[];
  savingsGoals?: { id: string; label: string; amount: number; targetAmount?: number; currentAmount?: number }[];
  onSubmit: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onClose?: () => void;
  defaultCategoryId?: string;
  expenseToEdit?: Expense;
  initialPrefill?: {
    amount?: number | string;
    note?: string;
    category?: string;
    date?: string;
    paymentMethod?: 'cash' | 'card';
  };
  onOpenCategoryManager?: () => void;
  onOpenWalletSync?: () => void;
}

const getLocalYYYYMMDD = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDarkTextColor = (colorStr: string) => {
  const s = colorStr.toLowerCase();
  if (s.includes('emerald')) return 'text-emerald-800';
  if (s.includes('rose')) return 'text-rose-800';
  if (s.includes('purple')) return 'text-purple-800';
  if (s.includes('amber')) return 'text-amber-800';
  if (s.includes('blue')) return 'text-blue-800';
  if (s.includes('slate')) return 'text-slate-800';
  if (s.includes('indigo')) return 'text-indigo-800';
  if (s.includes('pink')) return 'text-pink-600';
  return 'text-slate-800';
};

export function ExpenseForm({ categories, savingsGoals, onSubmit, onClose, defaultCategoryId, expenseToEdit, initialPrefill, onOpenCategoryManager, onOpenWalletSync }: ExpenseFormProps) {
  const isMobile = useIsMobileDevice();
  const [amount, setAmount] = useState<string>(
    expenseToEdit 
      ? expenseToEdit.amount.toString() 
      : (initialPrefill?.amount !== undefined && initialPrefill.amount !== '' ? String(initialPrefill.amount) : '')
  );
  
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (expenseToEdit) return expenseToEdit.category;
    if (initialPrefill?.category) {
      // Try finding matching category by ID or name
      const targetCat = categories.find(c => c.id === initialPrefill.category || c.name.toLowerCase() === initialPrefill.category?.toLowerCase());
      if (targetCat) return targetCat.id;
    }
    if (defaultCategoryId && categories.some(c => c.id === defaultCategoryId && !c.isHidden)) {
      return defaultCategoryId;
    }
    return categories.some(c => c.id === 'cat_uncategorized' && !c.isHidden)
      ? 'cat_uncategorized'
      : (categories.find(c => !c.isHidden)?.id || 'cat_uncategorized');
  });

  // Compute selected Savings Goal capacity
  const selectedSavingsGoal = selectedCategory.startsWith('SAVINGS_') && savingsGoals
    ? savingsGoals.find(g => g.id === selectedCategory.substring(8))
    : null;
  const currentGoalBalance = selectedSavingsGoal ? (selectedSavingsGoal.currentAmount ?? selectedSavingsGoal.amount ?? 0) : 0;
  const editingOriginalAmount = (expenseToEdit && expenseToEdit.category === selectedCategory) ? expenseToEdit.amount : 0;
  const availableSavingsCapacity = currentGoalBalance + editingOriginalAmount;
  const [note, setNote] = useState<string>(
    expenseToEdit 
      ? expenseToEdit.note 
      : (initialPrefill?.note || '')
  );
  const [date, setDate] = useState<string>(
    expenseToEdit 
      ? expenseToEdit.date 
      : (initialPrefill?.date || getLocalYYYYMMDD())
  );
  const [paymentMethod, setPaymentMethod] = useState<Expense['paymentMethod']>(
    expenseToEdit 
      ? expenseToEdit.paymentMethod 
      : (initialPrefill?.paymentMethod || 'card')
  );
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showBusinessPopup, setShowBusinessPopup] = useState<boolean>(false);

  // Custom Calendar Popover States
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const d = new Date(expenseToEdit ? expenseToEdit.date : new Date());
    return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const d = new Date(expenseToEdit ? expenseToEdit.date : new Date());
    return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth(); // 0-indexed
  });

  // Category Reordering states
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('personal_finance_app_category_order');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isReordering, setIsReordering] = useState<boolean>(false);

  // Drag and Drop reordering states
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);

  // Autofocus input ref
  const amountInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Sync calendar's year and month whenever the popover is opened
  useEffect(() => {
    if (showCalendar && date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1; // 0-indexed
        if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
          setCalendarYear(y);
          setCalendarMonth(m);
        }
      }
    }
  }, [showCalendar]);

  // Click Outside to close custom calendar drop down
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showCalendar]);

  // Sync category ordering on initial render
  useEffect(() => {
    if (categories && categories.length > 0) {
      const raw = localStorage.getItem('personal_finance_app_category_order');
      let currentOrder: string[] = [];
      try {
        currentOrder = raw ? JSON.parse(raw) : [];
      } catch {
        currentOrder = [];
      }

      const validIDs = categories.map(c => c.id);
      const filteredOrder = currentOrder.filter(id => validIDs.includes(id));
      const missingIDs = validIDs.filter(id => !filteredOrder.includes(id));

      if (missingIDs.length > 0 || filteredOrder.length !== currentOrder.length) {
        const finalOrder = [...filteredOrder, ...missingIDs];
        setCategoryOrder(finalOrder);
        try {
          localStorage.setItem('personal_finance_app_category_order', JSON.stringify(finalOrder));
        } catch (e) {
          // ignore
        }
      }
    }
  }, [categories]);

  // Handle autoFocus on add screen but not on edit screen
  useEffect(() => {
    if (!expenseToEdit && amountInputRef.current) {
      const timeoutId = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 180);
      return () => clearTimeout(timeoutId);
    }
  }, [expenseToEdit]);

  const getOrderedCategories = () => {
    // Filter out hidden categories unless currently editing an expense that uses that hidden category
    const list = categories.filter(c => !c.isHidden || (expenseToEdit && expenseToEdit.category === c.id));
    list.sort((a, b) => {
      let indexA = categoryOrder.indexOf(a.id);
      let indexB = categoryOrder.indexOf(b.id);
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;
      return indexA - indexB;
    });
    return list;
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedCatId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedCatId) {
      setDragOverCatId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    if (dragOverCatId === id) {
      setDragOverCatId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedCatId;
    if (sourceId && sourceId !== targetId) {
      const ordered = getOrderedCategories();
      const sourceIdx = ordered.findIndex(c => c.id === sourceId);
      const targetIdx = ordered.findIndex(c => c.id === targetId);

      if (sourceIdx !== -1 && targetIdx !== -1) {
        const itemToMove = ordered[sourceIdx];
        const newOrdered = [...ordered];
        newOrdered.splice(sourceIdx, 1);
        newOrdered.splice(targetIdx, 0, itemToMove);

        const newOrder = newOrdered.map(c => c.id);
        setCategoryOrder(newOrder);
        try {
          localStorage.setItem('personal_finance_app_category_order', JSON.stringify(newOrder));
        } catch (err) {
          // ignore
        }
      }
    }
    setDraggedCatId(null);
    setDragOverCatId(null);
  };

  const handleDragEnd = () => {
    setDraggedCatId(null);
    setDragOverCatId(null);
  };

  // Safe mathematical expression evaluator for arithmetic (+, -, *, /)
  const evaluateExpression = (expr: string): number | null => {
    // Strip everything except numbers, decimal point, operators (+, -, *, /), parentheses, and spaces
    const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '');
    if (!sanitized.trim()) return null;

    try {
      if (/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        // Safe evaluation via standard Function constructor since input is strictly sanitized
        const result = new Function(`return (${sanitized})`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
          return result;
        }
      }
    } catch {
      // Syntax error in equation
    }
    return null;
  };

  // Preset button click remains simple
  const handlePresetClick = (val: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + val).toString());
  };

  const handleAmountBlur = () => {
    if (amount) {
      const live = evaluateExpression(amount);
      if (live !== null && /[\+\-\*\/]/.test(amount)) {
        setAmount(live.toFixed(2));
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    let resolvedAmountStr = amount;
    const evaluated = evaluateExpression(amount);
    if (evaluated !== null && /[\+\-\*\/]/.test(amount)) {
      resolvedAmountStr = evaluated.toFixed(2);
      setAmount(resolvedAmountStr);
    }

    const parsedAmount = parseFloat(resolvedAmountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorCode('Please enter a valid expense amount greater than $0.');
      return;
    }
    if (!selectedCategory) {
      setErrorCode('Please select a categorization tag.');
      return;
    }

    // Validate that expense does not exceed available funds in chosen Savings Goal
    if (selectedSavingsGoal) {
      if (parsedAmount > availableSavingsCapacity + 0.001) {
        setErrorCode(`Expense amount ($${parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) exceeds available savings in "${selectedSavingsGoal.label}" ($${availableSavingsCapacity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Please adjust the amount or add funds to this goal first.`);
        return;
      }
    }

    // Prevent standard daily expenses from containing "savings" in the note/description
    if (!selectedCategory.startsWith('SAVINGS_') && note.toLowerCase().includes('savings')) {
      setErrorCode("Daily expenses cannot contain the word 'savings' in their description. Use a Savings category for savings goals.");
      return;
    }

    // Business Expenses require a description/note validation
    const catObj = categories.find(c => c.id === selectedCategory);
    const isBusinessCat = catObj && (
      catObj.id === 'cat_business_expense' ||
      catObj.name.toLowerCase() === 'business expense' ||
      catObj.name.toLowerCase() === 'business expenses' ||
      catObj.name.toLowerCase().includes('business')
    );

    if (isBusinessCat && !note.trim()) {
      setShowBusinessPopup(true);
      return;
    }

    onSubmit({
      amount: parsedAmount,
      category: selectedCategory,
      date,
      note: note.trim(),
      paymentMethod
    });

    // Reset state upon submission
    setAmount('');
    setNote('');
    setErrorCode(null);
    if (onClose) onClose();
  };

  const orderedCategories = getOrderedCategories();

  return (
    <div className="relative bg-[#111111] text-white rounded-t-2xl md:rounded-2xl py-3 px-4 border border-white/5 shadow-2xl max-w-md mx-auto max-h-[85vh] overflow-y-auto" id="expense_entry_sheet">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-2.5">
        <h3 className="text-base font-bold text-white flex items-center gap-1.5 uppercase tracking-wider font-sans">
          <Sparkles size={16} className="text-emerald-500 animate-pulse" />
          {expenseToEdit ? 'Edit Expense Log' : 'Daily Spending Expense'}
        </h3>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => handleSubmit()}
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg cursor-pointer active:scale-95 transition-all outline-hidden font-sans uppercase tracking-widest shadow-lg shadow-emerald-950/40"
          >
            {expenseToEdit ? 'Save' : 'Add'}
          </button>
          {onClose && (
            <button 
              type="button" 
              onClick={onClose}
              className="px-2 py-1 bg-neutral-800/80 hover:bg-red-950/80 hover:text-red-300 hover:border-red-900/50 text-neutral-400 font-bold text-[10px] rounded-md cursor-pointer active:scale-95 transition-all outline-hidden font-sans uppercase tracking-wider border border-white/5"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {errorCode && (
        <div className="mb-2.5 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg flex items-start gap-1.5 font-sans">
          <span>⚠️ {errorCode}</span>
        </div>
      )}

      {/* Tap-to-pay wallet auto-detect */}
      {!expenseToEdit && onOpenWalletSync && (
        <div className="mb-2.5 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/20 rounded-xl px-3 py-1.5 shadow-xs">
          <div className="flex items-center gap-2 min-w-0 pr-1">
            <Smartphone size={13} className="text-emerald-400 shrink-0" />
            <span className="text-[10px] text-slate-300 truncate">
              Detect from Google, Apple or Samsung Wallet
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              onOpenWalletSync();
            }}
            className="text-[9px] font-mono font-black text-emerald-350 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 px-2 py-0.5 rounded-md transition-all cursor-pointer shrink-0 uppercase tracking-wider"
          >
            Auto-Detect ⚡
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Amount Entry - BIGGER AND MORE NOTICEABLE */}
        <div>
          <div className="relative rounded-2xl bg-black/45 border border-white/5 py-3 px-4 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/50 focus-within:bg-black/80 transition-all flex flex-col items-center justify-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-sans">Amount</span>
            <div className="flex items-center justify-center w-full min-w-0">
              <span className="text-3xl font-extrabold text-emerald-500 mr-1.5 select-none tnum">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={handleAmountBlur}
                className="w-full max-w-[240px] bg-transparent border-0 text-3xl font-extrabold text-emerald-400 focus:text-white text-center tnum tracking-tight outline-hidden focus:ring-0 focus:outline-hidden placeholder-emerald-800/35 p-0"
                required
                ref={amountInputRef}
              />
            </div>

            {/* Available Savings Goal Balance Badge */}
            {selectedSavingsGoal && (
              <div className="mt-2.5 w-full px-3 py-1.5 bg-pink-500/10 border border-pink-500/30 rounded-xl flex items-center justify-between text-xs text-pink-300 font-sans">
                <span>Available in <strong>{selectedSavingsGoal.label}</strong>:</span>
                <span className="font-extrabold text-pink-200 tnum text-sm">${availableSavingsCapacity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}

            {/* Live calculation helper badge */}
            {(() => {
              const liveVal = evaluateExpression(amount);
              const hasOperators = /[\+\-\*\/]/.test(amount);
              if (amount && hasOperators && liveVal !== null) {
                return (
                  <button
                    type="button"
                    onClick={() => setAmount(liveVal.toFixed(2))}
                    className="mt-2.5 px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 text-xs font-bold rounded-lg transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 tnum"
                    title="Tap to apply calculated total"
                  >
                    <span>Total: ${liveVal.toFixed(2)}</span>
                    <span className="text-[9px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-400 font-sans">Apply ↵</span>
                  </button>
                );
              }
              return null;
            })()}

            {/* Operator shortcuts for fast mobile entry */}
            <div className="flex items-center justify-center gap-2 mt-2.5 select-none w-full border-t border-white/5 pt-2.5">
              {['+', '-', '*', '/'].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => {
                    const trimmed = amount.trim();
                    if (/[\+\-\*\/]$/.test(trimmed)) {
                      setAmount(trimmed.slice(0, -1) + op);
                    } else {
                      setAmount(trimmed + (trimmed ? ` ${op} ` : op));
                    }
                    amountInputRef.current?.focus();
                  }}
                  className="w-12 h-10 rounded-xl bg-white/5 border border-white/10 text-lg text-slate-200 font-mono font-bold flex items-center justify-center hover:bg-white/10 hover:text-white cursor-pointer select-none active:scale-95 transition-all shadow-xs"
                >
                  {op}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setAmount('');
                  amountInputRef.current?.focus();
                }}
                className="px-3 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-extrabold tracking-wider uppercase flex items-center justify-center hover:bg-rose-500/20 cursor-pointer select-none active:scale-95 transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Category Picker with Interactive Reordering */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <label className="block text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest font-sans">BUDGET CATEGORY</label>
              <span className="text-[8px] text-slate-350 block font-sans lowercase tracking-wide">
                Tip: Drag & drop cards to reorder
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer select-none active:scale-95"
                >
                  + Edit Categories
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsReordering(!isReordering)}
                className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md transition-all cursor-pointer select-none active:scale-95 ${
                  isReordering 
                    ? 'bg-emerald-600 text-white font-black' 
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {isReordering ? '✓ Done' : '⇅ Arrange'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
            {orderedCategories.map((cat) => (
              <div
                key={cat.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, cat.id)}
                onDragOver={(e) => handleDragOver(e, cat.id)}
                onDragLeave={(e) => handleDragLeave(e, cat.id)}
                onDrop={(e) => handleDrop(e, cat.id)}
                onDragEnd={handleDragEnd}
                className={`py-1.5 px-2 flex flex-col items-center justify-center rounded-xl border text-center transition-all relative cursor-grab active:cursor-grabbing select-none ${
                  draggedCatId === cat.id
                    ? 'opacity-40 scale-95 border-dashed border-emerald-500/40 bg-black/10'
                    : dragOverCatId === cat.id
                      ? 'border-emerald-400 bg-emerald-500/15 scale-105 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-550/20'
                      : isReordering
                        ? 'border-dashed border-emerald-500/40 bg-black/40 hover:border-emerald-500/60'
                        : selectedCategory === cat.id
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-xs font-bold ring-1 ring-emerald-500/10'
                          : 'border-white/5 hover:border-white/10 text-slate-300 bg-black/20 hover:bg-black/35'
                }`}
              >
                {!isReordering && !draggedCatId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="absolute inset-0 w-full h-full cursor-pointer rounded-xl bg-transparent border-0"
                    title={`Select ${cat.name}`}
                  />
                ) : null}

                <div className={`p-1 px-2 rounded-md mb-1 text-[10px] uppercase font-black tracking-wider select-none pointer-events-none shadow-xs flex items-center justify-center min-w-[24px] min-h-[22px] ${
                  cat.id.startsWith('SAVINGS_')
                    ? 'bg-pink-500 text-white border border-pink-400/30'
                    : `bg-white border border-white/5 ${getDarkTextColor(cat.color)}`
                }`}>
                  {cat.id.startsWith('SAVINGS_') ? (
                    renderCategoryIcon('PiggyBank', 12)
                  ) : (
                    cat.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <span className={`text-[10.5px] font-semibold truncate w-full tracking-tight select-none pointer-events-none transition-colors ${selectedCategory === cat.id ? 'text-white font-extrabold' : 'text-gray-200'}`}>
                  {cat.id.startsWith('SAVINGS_') ? cat.name.replace(/^SAVINGS\s*-\s*/i, '') : cat.name}
                </span>

                {isReordering && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded mt-1.5 pointer-events-none select-none animate-pulse">
                    Drag ☰
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Note / Memo */}
        <div>
          <label className="block text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest mb-1">DESCRIPTION</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-300">
               <MessageSquare size={14} />
            </span>
            <input
              type="text"
              placeholder="e.g. Starbucks, Target, Uber ride..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              ref={noteInputRef}
              className="w-full pl-8.5 pr-4 py-2 bg-black/40 border border-white/10 focus:border-emerald-500 focus:bg-[#0A0A0A] focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-white outline-hidden transition-all"
            />
          </div>
        </div>

        {/* Two-Column Date & Payment Method */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative" ref={calendarRef}>
            <label className="block text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest mb-1">DATE</label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={date}
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full pl-3 pr-8 py-2 bg-black/40 border border-white/10 focus:border-emerald-500 focus:bg-[#0A0A0A] focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-white outline-hidden cursor-pointer select-none transition-all font-mono"
                required
                placeholder="YYYY-MM-DD"
              />
              {/* Dropdown Calendar Toggle Button */}
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="absolute right-2.5 top-2.5 text-slate-200 hover:text-emerald-400 transition-all cursor-pointer bg-transparent border-0"
                title="Open Calendar drop down"
              >
                <Calendar size={14} className={showCalendar ? "text-emerald-400 scale-110 transition-all" : "transition-all"} />
              </button>
            </div>

            {/* Custom Interactive Floating Calendar Drop Down */}
            {showCalendar && (
              <div 
                className="absolute left-0 mt-1.5 p-3 bg-[#161616] border border-white/10 rounded-xl shadow-2xl z-50 text-white text-xs w-64 select-none animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 font-sans">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (calendarMonth === 0) {
                        setCalendarMonth(11);
                        setCalendarYear(y => y - 1);
                      } else {
                        setCalendarMonth(m => m - 1);
                      }
                    }}
                    className="p-1 px-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-md cursor-pointer border-0 bg-transparent text-[10px]"
                  >
                    ◀
                  </button>
                  <span className="font-bold text-[9px] uppercase tracking-widest text-[#eeeeee]">
                    {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (calendarMonth === 11) {
                          setCalendarMonth(0);
                          setCalendarYear(y => y + 1);
                        } else {
                          setCalendarMonth(m => m + 1);
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
                        setShowCalendar(false);
                      }}
                      className="p-1 hover:bg-white/10 text-gray-400 hover:text-rose-400 rounded-md cursor-pointer border-0 bg-transparent text-[10px] ml-1"
                      title="Close Calendar"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 text-center text-[8px] font-bold uppercase text-slate-350 mb-1">
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
                  {/* Empty pads representing align-offset of start of active month */}
                  {Array.from({ length: new Date(calendarYear, calendarMonth, 1).getDay() }).map((_, idx) => (
                    <span key={`empty-${idx}`} />
                  ))}

                  {/* Day numbers */}
                  {Array.from({ length: new Date(calendarYear, calendarMonth + 1, 0).getDate() }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const thisDateString = `${calendarYear}-${(calendarMonth + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                    const isSelected = thisDateString === date;

                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDate(thisDateString);
                          setShowCalendar(false);
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

          <div>
            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1">Payment Method</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-slate-300">
                <CreditCard size={13} />
              </span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as Expense['paymentMethod'])}
                className="w-full pl-8 pr-2 py-2 bg-black/40 border border-white/10 focus:border-emerald-500 focus:bg-[#0A0A0A] focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-white outline-hidden tracking-tight transition-all cursor-pointer"
              >
                <option value="card" className="bg-[#111111] text-white">💳 Card</option>
                <option value="digital_wallet" className="bg-[#111111] text-white">📱 Digital Wallet</option>
                <option value="cash" className="bg-[#111111] text-white">💵 Cash</option>
                <option value="other" className="bg-[#111111] text-white">⚙️ Other</option>
              </select>
            </div>
          </div>
        </div>

      </form>

      {/* Custom Popup Modal for Business Expense Validation */}
      {showBusinessPopup && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 rounded-2xl animate-in fade-in duration-200">
          <div className="bg-[#1A1A1A] border border-rose-500/35 rounded-xl p-5 max-w-xs w-full shadow-2xl text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 text-xl font-bold mb-3 animate-bounce">
              ⚠️
            </div>
            <h4 className="text-sm font-extrabold uppercase tracking-wider text-rose-400 mb-2">
              Description Required
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed mb-5">
              Business Expenses require a description outlining reason for Expense and/or location
            </p>
            <button
              type="button"
              onClick={() => {
                setShowBusinessPopup(false);
                setTimeout(() => {
                  noteInputRef.current?.focus();
                }, 80);
              }}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border-0"
            >
              Enter Description
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
