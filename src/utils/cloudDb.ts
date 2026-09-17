import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  writeBatch 
} from '../firebase';
import { Expense, Category, MonthlyBudget } from '../types';
import { LocalDb } from './db';
import { SubscriptionManager } from './subscription';

/**
 * Helper to recursively remove keys with undefined values
 * Firestore throws an error if an object passed to setDoc contains undefined properties.
 */
function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export const SyncQueue = {
  getPendingDeletes(type: string): string[] {
    try {
      return JSON.parse(localStorage.getItem(`expensetrack_pending_deletes_${type}`) || '[]');
    } catch { return []; }
  },
  addPendingDelete(type: string, id: string) {
    const list = this.getPendingDeletes(type);
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(`expensetrack_pending_deletes_${type}`, JSON.stringify(list));
    }
  },
  removePendingDelete(type: string, id: string) {
    const list = this.getPendingDeletes(type).filter(i => i !== id);
    localStorage.setItem(`expensetrack_pending_deletes_${type}`, JSON.stringify(list));
  },
  getPendingEdits(type: string): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(`expensetrack_pending_edits_${type}`) || '{}');
    } catch { return {}; }
  },
  addPendingEdit(type: string, id: string, timestamp: number = Date.now()) {
    const edits = this.getPendingEdits(type);
    edits[id] = timestamp;
    localStorage.setItem(`expensetrack_pending_edits_${type}`, JSON.stringify(edits));
  },
  removePendingEdit(type: string, id: string) {
    const edits = this.getPendingEdits(type);
    delete edits[id];
    localStorage.setItem(`expensetrack_pending_edits_${type}`, JSON.stringify(edits));
  },
  getPendingCreates(type: string): string[] {
    try {
      return JSON.parse(localStorage.getItem(`expensetrack_pending_creates_${type}`) || '[]');
    } catch { return []; }
  },
  addPendingCreate(type: string, id: string) {
    const list = this.getPendingCreates(type);
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(`expensetrack_pending_creates_${type}`, JSON.stringify(list));
    }
  },
  removePendingCreate(type: string, id: string) {
    const list = this.getPendingCreates(type).filter(i => i !== id);
    localStorage.setItem(`expensetrack_pending_creates_${type}`, JSON.stringify(list));
  }
};

export const CloudDb = {
  /**
   * Syncs current local storage data into Firestore for the current user
   */
  async uploadLocalDataToCloud(userId: string): Promise<void> {
    if (!userId) return;

    try {
      // Process pending deletes first
      const collectionsToSync = ['expenses', 'categories', 'income', 'fixed', 'savings'];
      for (const colType of collectionsToSync) {
        const pendingDels = SyncQueue.getPendingDeletes(colType);
        for (const delId of pendingDels) {
          if (colType === 'expenses') await this.deleteExpenseFromCloud(userId, delId);
          else if (colType === 'categories') await this.deleteCategoryFromCloud(userId, delId);
          else if (colType === 'income') await this.deleteIncomeStreamFromCloud(userId, delId);
          else if (colType === 'fixed') await this.deleteFixedExpenseFromCloud(userId, delId);
          else if (colType === 'savings') await this.deleteSavingsGoalFromCloud(userId, delId);
          SyncQueue.removePendingDelete(colType, delId);
        }
      }

      const pendingExpDeletes = new Set(SyncQueue.getPendingDeletes('expenses'));
      const expenses = LocalDb.getExpenses().filter(e => !pendingExpDeletes.has(e.id));
      const pendingCatDeletes = new Set(SyncQueue.getPendingDeletes('categories'));
      const categories = LocalDb.getCategoriesOnly().filter(c => !pendingCatDeletes.has(c.id));
      const budgets = LocalDb.getBudgets();
      const pendingIncDeletes = new Set(SyncQueue.getPendingDeletes('income'));
      const incomeStreams = (JSON.parse(localStorage.getItem('expensetrack_income_streams') || '[]') as any[]).filter(i => !pendingIncDeletes.has(i.id));
      const pendingFixDeletes = new Set(SyncQueue.getPendingDeletes('fixed'));
      const fixedExpenses = (JSON.parse(localStorage.getItem('expensetrack_fixed_expenses') || '[]') as any[]).filter(f => !pendingFixDeletes.has(f.id));
      const pendingSavDeletes = new Set(SyncQueue.getPendingDeletes('savings'));
      const savingsGoals = (JSON.parse(localStorage.getItem('expensetrack_savings_goals') || '[]') as any[]).filter(s => !pendingSavDeletes.has(s.id));
      const currencySymbol = LocalDb.getCurrencySymbol();
      const defaultCategoryId = LocalDb.getDefaultCategoryId();
      const lastReconciliationMonth = localStorage.getItem('last_reconciliation_month') || '';

      // 1. User profile doc
      const currentSubState = SubscriptionManager.getSubscriptionState();
      await setDoc(doc(db, 'userProfiles', userId), cleanUndefined({
        userId,
        currencySymbol,
        defaultCategoryId,
        lastReconciliationMonth,
        subscription: currentSubState,
        updatedAt: Date.now()
      }), { merge: true });

      // 2. Upload Expenses
      if (expenses.length > 0) {
        const expBatch = writeBatch(db);
        for (const exp of expenses) {
          expBatch.set(doc(db, 'expenses', exp.id), cleanUndefined({
            ...exp,
            userId,
            updatedAt: exp.updatedAt || Date.now()
          }), { merge: true });
        }
        await expBatch.commit();
      }

      // 3. Upload Categories
      if (categories.length > 0) {
        const catBatch = writeBatch(db);
        for (const cat of categories) {
          catBatch.set(doc(db, 'categories', cat.id), cleanUndefined({
            ...cat,
            userId
          }), { merge: true });
        }
        await catBatch.commit();
      }

      // 4. Upload Budgets
      if (budgets.length > 0) {
        const budBatch = writeBatch(db);
        for (const bud of budgets) {
          const docId = `bud_${bud.month}`;
          budBatch.set(doc(db, 'budgets', docId), cleanUndefined({
            ...bud,
            id: docId,
            userId
          }), { merge: true });
        }
        await budBatch.commit();
      }

      // 5. Upload Income Streams
      if (incomeStreams.length > 0) {
        try {
          const incBatch = writeBatch(db);
          for (const inc of incomeStreams) {
            const incId = String(inc.id || `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            incBatch.set(doc(db, 'incomeStreams', incId), cleanUndefined({
              ...inc,
              id: incId,
              userId
            }), { merge: true });
          }
          await incBatch.commit();
        } catch (incErr) {
          console.error('Error uploading incomeStreams batch:', incErr);
        }
      }

      // 6. Upload Fixed Expenses
      if (fixedExpenses.length > 0) {
        try {
          const fixBatch = writeBatch(db);
          for (const fix of fixedExpenses) {
            const fixId = String(fix.id || `fix_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            fixBatch.set(doc(db, 'fixedExpenses', fixId), cleanUndefined({
              ...fix,
              id: fixId,
              userId
            }), { merge: true });
          }
          await fixBatch.commit();
        } catch (fixErr) {
          console.error('Error uploading fixedExpenses batch:', fixErr);
        }
      }

      // 7. Upload Savings Goals
      if (savingsGoals.length > 0) {
        try {
          const savBatch = writeBatch(db);
          for (const sav of savingsGoals) {
            const savId = String(sav.id || `sav_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            savBatch.set(doc(db, 'savingsGoals', savId), cleanUndefined({
              ...sav,
              id: savId,
              userId
            }), { merge: true });
          }
          await savBatch.commit();
        } catch (savErr) {
          console.error('Error uploading savingsGoals batch:', savErr);
        }
      }

      console.log('Local data successfully uploaded & synced to Firestore');
    } catch (error) {
      console.error('Error uploading local data to cloud:', error);
    }
  },

  /**
   * Downloads user data from Firestore and populates LocalStorage & local cache
   */
  async downloadCloudDataToLocal(userId: string): Promise<boolean> {
    if (!userId) return false;

    try {
      // Capture current local state BEFORE downloading cloud data
      const localExpenses = LocalDb.getExpenses();
      const localCategories = LocalDb.getCategoriesOnly();
      const localInc = JSON.parse(localStorage.getItem('expensetrack_income_streams') || '[]');
      const localFix = JSON.parse(localStorage.getItem('expensetrack_fixed_expenses') || '[]');
      const localSav = JSON.parse(localStorage.getItem('expensetrack_savings_goals') || '[]');

      // Execute any pending deletes on the server
      const pendingExpDeletes = SyncQueue.getPendingDeletes('expenses');
      for (const delId of pendingExpDeletes) {
        await this.deleteExpenseFromCloud(userId, delId);
        SyncQueue.removePendingDelete('expenses', delId);
      }

      const pendingCatDeletes = SyncQueue.getPendingDeletes('categories');
      for (const delId of pendingCatDeletes) {
        await this.deleteCategoryFromCloud(userId, delId);
        SyncQueue.removePendingDelete('categories', delId);
      }

      const pendingIncDeletes = SyncQueue.getPendingDeletes('income');
      for (const delId of pendingIncDeletes) {
        await this.deleteIncomeStreamFromCloud(userId, delId);
        SyncQueue.removePendingDelete('income', delId);
      }

      const pendingFixDeletes = SyncQueue.getPendingDeletes('fixed');
      for (const delId of pendingFixDeletes) {
        await this.deleteFixedExpenseFromCloud(userId, delId);
        SyncQueue.removePendingDelete('fixed', delId);
      }

      const pendingSavDeletes = SyncQueue.getPendingDeletes('savings');
      for (const delId of pendingSavDeletes) {
        await this.deleteSavingsGoalFromCloud(userId, delId);
        SyncQueue.removePendingDelete('savings', delId);
      }

      // 1. Fetch user profile
      const profileSnap = await getDoc(doc(db, 'userProfiles', userId));

      // 2. Fetch Expenses
      const expQuery = query(collection(db, 'expenses'), where('userId', '==', userId));
      const expSnap = await getDocs(expQuery);

      // 3. Fetch Categories
      const catQuery = query(collection(db, 'categories'), where('userId', '==', userId));
      const catSnap = await getDocs(catQuery);

      // 4. Fetch Budgets
      const budQuery = query(collection(db, 'budgets'), where('userId', '==', userId));
      const budSnap = await getDocs(budQuery);

      // 5. Fetch Income Streams
      const incQuery = query(collection(db, 'incomeStreams'), where('userId', '==', userId));
      const incSnap = await getDocs(incQuery);

      // 6. Fetch Fixed Expenses
      const fixQuery = query(collection(db, 'fixedExpenses'), where('userId', '==', userId));
      const fixSnap = await getDocs(fixQuery);

      // 7. Fetch Savings Goals
      const savQuery = query(collection(db, 'savingsGoals'), where('userId', '==', userId));
      const savSnap = await getDocs(savQuery);

      const hasAnyCloudData = profileSnap.exists() || !expSnap.empty || !catSnap.empty || !budSnap.empty || !incSnap.empty || !fixSnap.empty || !savSnap.empty;

      if (!hasAnyCloudData) {
        return false;
      }

      // Process profile
      if (profileSnap.exists()) {
        const pData = profileSnap.data();
        if (pData.currencySymbol) LocalDb.setCurrencySymbol(pData.currencySymbol);
        if (pData.defaultCategoryId) LocalDb.setDefaultCategoryId(pData.defaultCategoryId);
        if (pData.lastReconciliationMonth) localStorage.setItem('last_reconciliation_month', pData.lastReconciliationMonth);
        if (pData.subscription) {
          SubscriptionManager.saveSubscriptionState(pData.subscription);
        }
      }

      // Process Expenses & merge any local unsynced edits/additions
      const pendingExpEdits = SyncQueue.getPendingEdits('expenses');
      const localExpMap = new Map(localExpenses.map(e => [e.id, e]));

      const expenses: Expense[] = [];
      expSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;

        // Ignore if deleted locally while offline
        if (pendingExpDeletes.includes(cloudId)) return;

        const cloudExp: Expense = {
          id: cloudId,
          amount: Number(data.amount) || 0,
          category: data.category || 'cat_uncategorized',
          date: data.date || '',
          note: data.note || data.title || '',
          paymentMethod: data.paymentMethod || 'card',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || 0
        };

        const localExp = localExpMap.get(cloudId);
        if (localExp) {
          const hasPendingEdit = !!pendingExpEdits[cloudId];
          const isLocalNewer = (localExp.updatedAt || 0) > (cloudExp.updatedAt || 0);
          if (hasPendingEdit || isLocalNewer) {
            expenses.push(localExp);
            this.saveExpenseToCloud(userId, localExp).then(() => {
              SyncQueue.removePendingEdit('expenses', cloudId);
            }).catch(console.error);
            return;
          }
        }

        expenses.push(cloudExp);
      });

      const cloudExpIds = new Set(expenses.map(e => e.id));
      const pendingExpCreates = new Set(SyncQueue.getPendingCreates('expenses'));
      const unsyncedLocalExp = localExpenses.filter(e => e.id && !cloudExpIds.has(e.id) && pendingExpCreates.has(e.id) && !pendingExpDeletes.includes(e.id));
      if (unsyncedLocalExp.length > 0) {
        expenses.push(...unsyncedLocalExp);
        unsyncedLocalExp.forEach(e => {
          this.saveExpenseToCloud(userId, e).then(() => {
            SyncQueue.removePendingCreate('expenses', e.id);
          }).catch(console.error);
        });
      }

      expenses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      localStorage.setItem('personal_finance_app_expenses', JSON.stringify(expenses));

      // Process Categories & merge any local unsynced additions
      const categories: Category[] = [];
      if (!catSnap.empty) {
        catSnap.forEach(d => {
          const data = d.data();
          const cloudId = data.id || d.id;
          if (pendingCatDeletes.includes(cloudId)) return;

          categories.push({
            id: cloudId,
            name: data.name || '',
            icon: data.icon || 'Tag',
            color: data.color || '',
            textColor: data.textColor || '',
            isDefault: !!data.isDefault,
            limit: Number(data.limit) || 0,
            isHidden: !!data.isHidden
          });
        });
      }

      if (categories.length > 0 || localCategories.length > 0) {
        const cloudCatIds = new Set(categories.map(c => c.id));
        const pendingCatCreates = new Set(SyncQueue.getPendingCreates('categories'));
        const unsyncedLocalCat = localCategories.filter(c => c.id && !cloudCatIds.has(c.id) && pendingCatCreates.has(c.id) && !pendingCatDeletes.includes(c.id));
        if (unsyncedLocalCat.length > 0) {
          categories.push(...unsyncedLocalCat);
          unsyncedLocalCat.forEach(c => {
            this.saveCategoryToCloud(userId, c).then(() => {
              SyncQueue.removePendingCreate('categories', c.id);
            }).catch(console.error);
          });
        }
        localStorage.setItem('personal_finance_app_categories', JSON.stringify(categories));
      }

      // Process Budgets
      if (!budSnap.empty) {
        const budgets: MonthlyBudget[] = [];
        budSnap.forEach(d => {
          const data = d.data();
          budgets.push({
            month: data.month,
            limitAmount: Number(data.limitAmount) || 0,
            categoryLimits: data.categoryLimits || {}
          });
        });
        localStorage.setItem('personal_finance_app_budget', JSON.stringify(budgets));
      }

      // Process Income Streams
      const incomeStreams: any[] = [];
      incSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        if (pendingIncDeletes.includes(cloudId)) return;

        incomeStreams.push({
          id: cloudId,
          label: data.label,
          amount: Number(data.amount) || 0,
          frequency: data.frequency,
          isHidden: !!data.isHidden
        });
      });

      const cloudIncIds = new Set(incomeStreams.map(i => i.id));
      const pendingIncCreates = new Set(SyncQueue.getPendingCreates('income'));
      const unsyncedLocalInc = localInc.filter((i: any) => i.id && !cloudIncIds.has(i.id) && pendingIncCreates.has(i.id) && !pendingIncDeletes.includes(i.id));
      if (unsyncedLocalInc.length > 0) {
        incomeStreams.push(...unsyncedLocalInc);
        unsyncedLocalInc.forEach((inc: any) => {
          this.saveIncomeStreamToCloud(userId, inc).then(() => {
            SyncQueue.removePendingCreate('income', inc.id);
          }).catch(console.error);
        });
      }
      localStorage.setItem('expensetrack_income_streams', JSON.stringify(incomeStreams));

      // Process Fixed Expenses
      const fixedExpenses: any[] = [];
      fixSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        if (pendingFixDeletes.includes(cloudId)) return;

        fixedExpenses.push({
          id: cloudId,
          label: data.label,
          amount: Number(data.amount) || 0,
          dueDate: data.dueDate,
          isHidden: !!data.isHidden
        });
      });

      const cloudFixIds = new Set(fixedExpenses.map(f => f.id));
      const pendingFixCreates = new Set(SyncQueue.getPendingCreates('fixed'));
      const unsyncedLocalFix = localFix.filter((f: any) => f.id && !cloudFixIds.has(f.id) && pendingFixCreates.has(f.id) && !pendingFixDeletes.includes(f.id));
      if (unsyncedLocalFix.length > 0) {
        fixedExpenses.push(...unsyncedLocalFix);
        unsyncedLocalFix.forEach((fix: any) => {
          this.saveFixedExpenseToCloud(userId, fix).then(() => {
            SyncQueue.removePendingCreate('fixed', fix.id);
          }).catch(console.error);
        });
      }
      localStorage.setItem('expensetrack_fixed_expenses', JSON.stringify(fixedExpenses));

      // Process Savings Goals
      const savingsGoals: any[] = [];
      savSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        if (pendingSavDeletes.includes(cloudId)) return;

        savingsGoals.push({
          id: cloudId,
          label: data.label,
          amount: Math.round(((Number(data.amount) || 0) + Number.EPSILON) * 100) / 100,
          targetAmount: Math.round(((Number(data.targetAmount) || 0) + Number.EPSILON) * 100) / 100,
          currentAmount: Math.round(((Number(data.currentAmount) || 0) + Number.EPSILON) * 100) / 100,
          allocationPercent: Number(data.allocationPercent) || 0,
          isHidden: !!data.isHidden
        });
      });

      const cloudSavIds = new Set(savingsGoals.map(s => s.id));
      const pendingSavCreates = new Set(SyncQueue.getPendingCreates('savings'));
      const unsyncedLocalSav = localSav.filter((s: any) => s.id && !cloudSavIds.has(s.id) && pendingSavCreates.has(s.id) && !pendingSavDeletes.includes(s.id));
      if (unsyncedLocalSav.length > 0) {
        savingsGoals.push(...unsyncedLocalSav);
        unsyncedLocalSav.forEach((sav: any) => {
          this.saveSavingsGoalToCloud(userId, sav).then(() => {
            SyncQueue.removePendingCreate('savings', sav.id);
          }).catch(console.error);
        });
      }
      localStorage.setItem('expensetrack_savings_goals', JSON.stringify(savingsGoals));

      localStorage.setItem('personal_finance_app_has_init', 'true');
      return true;
    } catch (error) {
      console.error('Error downloading cloud data:', error);
      return false;
    }
  },

  /**
   * Helper to write single items directly to cloud if authenticated
   */
  async saveExpenseToCloud(userId: string, expense: Expense): Promise<void> {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'expenses', expense.id), { ...expense, userId, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.error('Error saving expense to cloud:', e);
    }
  },

  async deleteExpenseFromCloud(userId: string, expenseId: string): Promise<void> {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
    } catch (e) {
      console.error('Error deleting expense from cloud:', e);
    }
  },

  async saveCategoryToCloud(userId: string, category: Category): Promise<void> {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'categories', category.id), { ...category, userId, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.error('Error saving category to cloud:', e);
    }
  },

  async deleteCategoryFromCloud(userId: string, categoryId: string): Promise<void> {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (e) {
      console.error('Error deleting category from cloud:', e);
    }
  },

  async saveSavingsGoalToCloud(userId: string, goal: any): Promise<void> {
    if (!userId || !goal) return;
    try {
      const gId = String(goal.id || `sav_${Date.now()}`);
      await setDoc(doc(db, 'savingsGoals', gId), cleanUndefined({ ...goal, id: gId, userId, updatedAt: Date.now() }), { merge: true });
    } catch (e) {
      console.error('Error saving goal to cloud:', e);
    }
  },

  async deleteSavingsGoalFromCloud(userId: string, goalId: string): Promise<void> {
    if (!userId || !goalId) return;
    try {
      await deleteDoc(doc(db, 'savingsGoals', goalId));
    } catch (e) {
      console.error('Error deleting savings goal from cloud:', e);
    }
  },

  async saveIncomeStreamToCloud(userId: string, stream: any): Promise<void> {
    if (!userId || !stream) return;
    try {
      const sId = String(stream.id || `inc_${Date.now()}`);
      await setDoc(doc(db, 'incomeStreams', sId), cleanUndefined({ ...stream, id: sId, userId, updatedAt: Date.now() }), { merge: true });
    } catch (e) {
      console.error('Error saving income stream to cloud:', e);
    }
  },

  async deleteIncomeStreamFromCloud(userId: string, streamId: string): Promise<void> {
    if (!userId || !streamId) return;
    try {
      await deleteDoc(doc(db, 'incomeStreams', streamId));
    } catch (e) {
      console.error('Error deleting income stream from cloud:', e);
    }
  },

  async saveFixedExpenseToCloud(userId: string, fixedExp: any): Promise<void> {
    if (!userId || !fixedExp) return;
    try {
      const fId = String(fixedExp.id || `fix_${Date.now()}`);
      await setDoc(doc(db, 'fixedExpenses', fId), cleanUndefined({ ...fixedExp, id: fId, userId, updatedAt: Date.now() }), { merge: true });
    } catch (e) {
      console.error('Error saving fixed expense to cloud:', e);
    }
  },

  async deleteFixedExpenseFromCloud(userId: string, fixedId: string): Promise<void> {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'fixedExpenses', fixedId));
    } catch (e) {
      console.error('Error deleting fixed expense from cloud:', e);
    }
  },

  async saveBudgetToCloud(userId: string, budget: MonthlyBudget): Promise<void> {
    if (!userId) return;
    try {
      const docId = `bud_${budget.month}`;
      await setDoc(doc(db, 'budgets', docId), { ...budget, id: docId, userId, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.error('Error saving budget to cloud:', e);
    }
  },

  async saveUserProfileToCloud(userId: string, profileData: any): Promise<void> {
    if (!userId) return;
    try {
      const payload = cleanUndefined({ ...profileData, userId, updatedAt: Date.now() });
      await setDoc(doc(db, 'userProfiles', userId), payload, { merge: true });
    } catch (e) {
      console.error('Error saving profile data to cloud:', e);
    }
  },

  /**
   * Subscribes to real-time Firestore data changes for the authenticated user
   */
  subscribeToCloudData(userId: string, onUpdate: () => void): () => void {
    if (!userId) return () => {};

    const unsubscribers: (() => void)[] = [];

    // 1. Realtime Expenses
    const expQuery = query(collection(db, 'expenses'), where('userId', '==', userId));
    const unsubExp = onSnapshot(expQuery, (expSnap) => {
      const localExpenses = LocalDb.getExpenses();
      const pendingDeletes = new Set(SyncQueue.getPendingDeletes('expenses'));
      const pendingEdits = SyncQueue.getPendingEdits('expenses');
      const localExpMap = new Map(localExpenses.map(e => [e.id, e]));

      const expenses: Expense[] = [];
      const remoteDocIds = new Set<string>();

      expSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        remoteDocIds.add(cloudId);

        if (pendingDeletes.has(cloudId)) {
          this.deleteExpenseFromCloud(userId, cloudId).catch(console.error);
          return;
        }

        const cloudExp: Expense = {
          id: cloudId,
          amount: Number(data.amount) || 0,
          category: data.category || 'cat_uncategorized',
          date: data.date || '',
          note: data.note || data.title || '',
          paymentMethod: data.paymentMethod || 'card',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || 0
        };

        const localExp = localExpMap.get(cloudId);
        if (localExp) {
          const hasPendingEdit = !!pendingEdits[cloudId];
          const isLocalNewer = (localExp.updatedAt || 0) > (cloudExp.updatedAt || 0);
          if (hasPendingEdit || isLocalNewer) {
            expenses.push(localExp);
            this.saveExpenseToCloud(userId, localExp).then(() => {
              SyncQueue.removePendingEdit('expenses', cloudId);
            }).catch(console.error);
            return;
          }
        }

        expenses.push(cloudExp);
      });

      // Clear confirmed deletes that are no longer in remote doc snapshot
      pendingDeletes.forEach(delId => {
        if (!remoteDocIds.has(delId)) {
          SyncQueue.removePendingDelete('expenses', delId);
        }
      });

      // Only re-upload and preserve items that were explicitly created locally offline
      const pendingCreates = SyncQueue.getPendingCreates('expenses');
      if (pendingCreates.length > 0) {
        const pendingCreateSet = new Set(pendingCreates);
        const unsyncedLocalExp = localExpenses.filter(e => e.id && !remoteDocIds.has(e.id) && pendingCreateSet.has(e.id) && !pendingDeletes.has(e.id));
        if (unsyncedLocalExp.length > 0) {
          expenses.push(...unsyncedLocalExp);
          unsyncedLocalExp.forEach(e => {
            this.saveExpenseToCloud(userId, e).then(() => {
              SyncQueue.removePendingCreate('expenses', e.id);
            }).catch(console.error);
          });
        }
      }

      expenses.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      localStorage.setItem('personal_finance_app_expenses', JSON.stringify(expenses));
      onUpdate();
    }, (err) => {
      console.error('Realtime expenses subscription notice:', err);
    });
    unsubscribers.push(unsubExp);

    // 2. Realtime Categories
    const catQuery = query(collection(db, 'categories'), where('userId', '==', userId));
    const unsubCat = onSnapshot(catQuery, (catSnap) => {
      const pendingCatDeletes = new Set(SyncQueue.getPendingDeletes('categories'));
      const localCategories = LocalDb.getCategoriesOnly();
      const remoteCatIds = new Set<string>();

      const categories: Category[] = [];
      catSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        remoteCatIds.add(cloudId);

        if (pendingCatDeletes.has(cloudId)) {
          this.deleteCategoryFromCloud(userId, cloudId).catch(console.error);
          return;
        }

        categories.push({
          id: cloudId,
          name: data.name || '',
          icon: data.icon || 'Tag',
          color: data.color || '',
          textColor: data.textColor || '',
          isDefault: !!data.isDefault,
          limit: Number(data.limit) || 0,
          isHidden: !!data.isHidden
        });
      });

      // Clear confirmed deletes
      pendingCatDeletes.forEach(delId => {
        if (!remoteCatIds.has(delId)) {
          SyncQueue.removePendingDelete('categories', delId);
        }
      });

      // Only preserve local categories if created offline
      const pendingCatCreates = SyncQueue.getPendingCreates('categories');
      if (pendingCatCreates.length > 0) {
        const pendingCreateSet = new Set(pendingCatCreates);
        const unsyncedLocalCat = localCategories.filter(c => c.id && !remoteCatIds.has(c.id) && pendingCreateSet.has(c.id) && !pendingCatDeletes.has(c.id));
        if (unsyncedLocalCat.length > 0) {
          categories.push(...unsyncedLocalCat);
          unsyncedLocalCat.forEach(c => {
            this.saveCategoryToCloud(userId, c).then(() => {
              SyncQueue.removePendingCreate('categories', c.id);
            }).catch(console.error);
          });
        }
      }

      if (categories.length > 0) {
        localStorage.setItem('personal_finance_app_categories', JSON.stringify(categories));
        onUpdate();
      }
    }, (err) => {
      console.error('Realtime categories subscription notice:', err);
    });
    unsubscribers.push(unsubCat);

    // 3. Realtime Budgets
    const budQuery = query(collection(db, 'budgets'), where('userId', '==', userId));
    const unsubBud = onSnapshot(budQuery, (budSnap) => {
      if (!budSnap.empty) {
        const budgets: MonthlyBudget[] = [];
        budSnap.forEach(d => {
          const data = d.data();
          budgets.push({
            month: data.month,
            limitAmount: Number(data.limitAmount) || 0,
            categoryLimits: data.categoryLimits || {}
          });
        });
        localStorage.setItem('personal_finance_app_budget', JSON.stringify(budgets));
        onUpdate();
      }
    }, (err) => {
      console.error('Realtime budgets subscription notice:', err);
    });
    unsubscribers.push(unsubBud);

    // 4. Realtime Income Streams
    const incQuery = query(collection(db, 'incomeStreams'), where('userId', '==', userId));
    const unsubInc = onSnapshot(incQuery, (incSnap) => {
      const pendingIncDeletes = new Set(SyncQueue.getPendingDeletes('income'));
      const localInc = JSON.parse(localStorage.getItem('expensetrack_income_streams') || '[]');
      const remoteIncIds = new Set<string>();

      const incomeStreams: any[] = [];
      incSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        remoteIncIds.add(cloudId);

        if (pendingIncDeletes.has(cloudId)) {
          this.deleteIncomeStreamFromCloud(userId, cloudId).catch(console.error);
          return;
        }

        incomeStreams.push({
          id: cloudId,
          label: data.label,
          amount: Number(data.amount) || 0,
          frequency: data.frequency,
          isHidden: !!data.isHidden
        });
      });

      // Clear confirmed deletes
      pendingIncDeletes.forEach(delId => {
        if (!remoteIncIds.has(delId)) {
          SyncQueue.removePendingDelete('income', delId);
        }
      });

      // Only preserve and upload if created offline
      const pendingIncCreates = SyncQueue.getPendingCreates('income');
      if (pendingIncCreates.length > 0) {
        const pendingCreateSet = new Set(pendingIncCreates);
        const unsyncedLocalInc = localInc.filter((i: any) => i.id && !remoteIncIds.has(i.id) && pendingCreateSet.has(i.id) && !pendingIncDeletes.has(i.id));
        if (unsyncedLocalInc.length > 0) {
          incomeStreams.push(...unsyncedLocalInc);
          unsyncedLocalInc.forEach((inc: any) => {
            this.saveIncomeStreamToCloud(userId, inc).then(() => {
              SyncQueue.removePendingCreate('income', inc.id);
            }).catch(console.error);
          });
        }
      }

      localStorage.setItem('expensetrack_income_streams', JSON.stringify(incomeStreams));
      onUpdate();
    }, (err) => {
      console.error('Realtime incomeStreams subscription notice:', err);
    });
    unsubscribers.push(unsubInc);

    // 5. Realtime Fixed Expenses
    const fixQuery = query(collection(db, 'fixedExpenses'), where('userId', '==', userId));
    const unsubFix = onSnapshot(fixQuery, (fixSnap) => {
      const pendingFixDeletes = new Set(SyncQueue.getPendingDeletes('fixed'));
      const localFix = JSON.parse(localStorage.getItem('expensetrack_fixed_expenses') || '[]');
      const remoteFixIds = new Set<string>();

      const fixedExpenses: any[] = [];
      fixSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        remoteFixIds.add(cloudId);

        if (pendingFixDeletes.has(cloudId)) {
          this.deleteFixedExpenseFromCloud(userId, cloudId).catch(console.error);
          return;
        }

        fixedExpenses.push({
          id: cloudId,
          label: data.label,
          amount: Number(data.amount) || 0,
          dueDate: data.dueDate,
          isHidden: !!data.isHidden
        });
      });

      // Clear confirmed deletes
      pendingFixDeletes.forEach(delId => {
        if (!remoteFixIds.has(delId)) {
          SyncQueue.removePendingDelete('fixed', delId);
        }
      });

      // Only preserve and upload if created offline
      const pendingFixCreates = SyncQueue.getPendingCreates('fixed');
      if (pendingFixCreates.length > 0) {
        const pendingCreateSet = new Set(pendingFixCreates);
        const unsyncedLocalFix = localFix.filter((f: any) => f.id && !remoteFixIds.has(f.id) && pendingCreateSet.has(f.id) && !pendingFixDeletes.has(f.id));
        if (unsyncedLocalFix.length > 0) {
          fixedExpenses.push(...unsyncedLocalFix);
          unsyncedLocalFix.forEach((fix: any) => {
            this.saveFixedExpenseToCloud(userId, fix).then(() => {
              SyncQueue.removePendingCreate('fixed', fix.id);
            }).catch(console.error);
          });
        }
      }

      localStorage.setItem('expensetrack_fixed_expenses', JSON.stringify(fixedExpenses));
      onUpdate();
    }, (err) => {
      console.error('Realtime fixedExpenses subscription notice:', err);
    });
    unsubscribers.push(unsubFix);

    // 6. Realtime Savings Goals
    const savQuery = query(collection(db, 'savingsGoals'), where('userId', '==', userId));
    const unsubSav = onSnapshot(savQuery, (savSnap) => {
      const pendingSavDeletes = new Set(SyncQueue.getPendingDeletes('savings'));
      const localSav = JSON.parse(localStorage.getItem('expensetrack_savings_goals') || '[]');
      const remoteSavIds = new Set<string>();

      const savingsGoals: any[] = [];
      savSnap.forEach(d => {
        const data = d.data();
        const cloudId = data.id || d.id;
        remoteSavIds.add(cloudId);

        if (pendingSavDeletes.has(cloudId)) {
          this.deleteSavingsGoalFromCloud(userId, cloudId).catch(console.error);
          return;
        }

        savingsGoals.push({
          id: cloudId,
          label: data.label,
          amount: Math.round(((Number(data.amount) || 0) + Number.EPSILON) * 100) / 100,
          targetAmount: Math.round(((Number(data.targetAmount) || 0) + Number.EPSILON) * 100) / 100,
          currentAmount: Math.round(((Number(data.currentAmount) || 0) + Number.EPSILON) * 100) / 100,
          allocationPercent: Number(data.allocationPercent) || 0,
          isHidden: !!data.isHidden
        });
      });

      // Clear confirmed deletes
      pendingSavDeletes.forEach(delId => {
        if (!remoteSavIds.has(delId)) {
          SyncQueue.removePendingDelete('savings', delId);
        }
      });

      // Only preserve and upload if created offline
      const pendingSavCreates = SyncQueue.getPendingCreates('savings');
      if (pendingSavCreates.length > 0) {
        const pendingCreateSet = new Set(pendingSavCreates);
        const unsyncedLocalSav = localSav.filter((s: any) => s.id && !remoteSavIds.has(s.id) && pendingCreateSet.has(s.id) && !pendingSavDeletes.has(s.id));
        if (unsyncedLocalSav.length > 0) {
          savingsGoals.push(...unsyncedLocalSav);
          unsyncedLocalSav.forEach((sav: any) => {
            this.saveSavingsGoalToCloud(userId, sav).then(() => {
              SyncQueue.removePendingCreate('savings', sav.id);
            }).catch(console.error);
          });
        }
      }

      localStorage.setItem('expensetrack_savings_goals', JSON.stringify(savingsGoals));
      onUpdate();
    }, (err) => {
      console.error('Realtime savingsGoals subscription notice:', err);
    });
    unsubscribers.push(unsubSav);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  },

  /**
   * Completely wipes all Firestore records for a user across all collections
   */
  async wipeUserCloudData(userId: string): Promise<void> {
    if (!userId) return;

    try {
      // 1. Wipe local database and pending sync queues
      LocalDb.clearAllData();

      // 2. Wipe all collections in Firestore for this user
      const collectionsToWipe = ['expenses', 'categories', 'budgets', 'incomeStreams', 'fixedExpenses', 'savingsGoals'];
      
      for (const colName of collectionsToWipe) {
        try {
          const q = query(collection(db, colName), where('userId', '==', userId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const deletePromises = snap.docs.map(d => 
              deleteDoc(d.ref).catch(err => console.error(`Error deleting doc ${d.id} from ${colName}:`, err))
            );
            await Promise.all(deletePromises);
          }
        } catch (colErr) {
          console.error(`Error querying/wiping collection ${colName}:`, colErr);
        }
      }

      // 3. Wipe userProfiles document
      try {
        await deleteDoc(doc(db, 'userProfiles', userId));
      } catch (e) {
        console.error('Error deleting user profile doc:', e);
      }

      console.log('User cloud data wiped successfully.');
    } catch (error) {
      console.error('Error in wipeUserCloudData:', error);
    }
  }
};
