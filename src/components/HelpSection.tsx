import React, { useState, useMemo } from 'react';
import {
  HelpCircle,
  Search,
  BookOpen,
  DollarSign,
  RefreshCw,
  Receipt,
  Cloud,
  Zap,
  Mail,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Info,
  Lock,
  ArrowRight,
  PieChart,
  Target,
  Sliders,
  Send,
  Check,
  Layers,
  Clock,
  Coins
} from 'lucide-react';
import { ActiveTab, SubscriptionState } from '../types';

interface HelpSectionProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSubscriptionModal?: () => void;
  onOpenAuthModal?: () => void;
  user?: any;
  subscriptionState?: SubscriptionState;
}

type CategoryFilter = 'all' | 'getting_started' | 'budgeting' | 'reconciliation' | 'expenses' | 'cloud' | 'subscription' | 'support';

interface FAQItem {
  id: string;
  category: CategoryFilter;
  question: string;
  answer: React.ReactNode;
  tags: string[];
}

export const HelpSection: React.FC<HelpSectionProps> = ({
  setActiveTab,
  onOpenSubscriptionModal,
  onOpenAuthModal,
  user,
  subscriptionState,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq_getting_started_1');

  // Feedback form state
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const categories: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Topics', icon: <BookOpen size={14} /> },
    { id: 'getting_started', label: 'Getting Started', icon: <Sparkles size={14} /> },
    { id: 'budgeting', label: 'Budget & Savings', icon: <DollarSign size={14} /> },
    { id: 'reconciliation', label: 'Reconciliation', icon: <RefreshCw size={14} /> },
    { id: 'expenses', label: 'Expenses & Business', icon: <Receipt size={14} /> },
    { id: 'cloud', label: 'Cloud Sync & Privacy', icon: <Cloud size={14} /> },
    { id: 'subscription', label: 'Subscription & Trial', icon: <Zap size={14} /> },
    { id: 'support', label: 'Contact Support', icon: <Mail size={14} /> },
  ];

  const faqs: FAQItem[] = [
    // GETTING STARTED
    {
      id: 'faq_getting_started_1',
      category: 'getting_started',
      question: 'How Does Loose Budget Work?',
      tags: ['intro', 'loose budget', 'overview', 'how to use', 'walk don\'t run'],
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p className="text-slate-200 font-medium leading-relaxed">
            LooseBudget works the way YOU want it to. You can simply track daily Expenses ( to see where your money is disappearing to ) or Set up Savings Goals that you control . The philosophy is that a budget should NOT feel like a prison sentence where you are confined every hour of the day ! LooseBudget allows you to enjoy life while helping you save .
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="font-bold text-emerald-400 block mb-1 text-xs">Walk don&apos;t run !</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Anyone can make a budget but, if you think you&apos;re spending $200 a month on coffee breaks while in reality it&apos;s $385 ... No approach in the world will save you. The only thing you actually need to track are the DAILY Expenses that you control .
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="font-bold text-blue-400 block mb-1 text-xs">See how much &quot;Spending&quot; money you actually have.</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                When you are ready, use the Budget tab to list all of your fixed expenses. You don&apos;t need to enter them each month. But you do need to see what is automatically coming out of your income each month. You&apos;d be surprised how many people just have a ballpark idea !
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="font-bold text-purple-400 block mb-1 text-xs">Savings Goals</span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Again, it&apos;s totally optional , but available to you . When you are ready you can list things you want to save for . Maybe you have none, that&apos;s fine. Most of us want to buy a new piece of furniture, or save for car repair bills , maybe a vacation ? It&apos;s whatever you want it to be . The system will do the math for you
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'faq_getting_started_2',
      category: 'getting_started',
      question: 'Where do I start when setting up my first budget?',
      tags: ['setup', 'first steps', 'income', 'plan'],
      answer: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-300">
          <p>Click on the <strong>BUDGET PLAN</strong> tab:</p>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-[11px]">
            💡 <strong>Income Tip:</strong> If income varies use an average or &quot;worst case&quot; scenario amount.
          </div>
          <ol className="list-decimal pl-4 space-y-2 text-slate-300">
            <li>
              <strong>Enter DAILY Expenses First:</strong> The Most important part is to enter the DAILY Expenses first ! You can add the Known and Savings Goals if and when you are ready later on . These are the expenses we&apos;ll concentrate on in the initial few weeks since you have the most control of them . Of course you can do it all as well , The Choice is up to you ! IF you aren&apos;t sure, put in your best guess . You can come back anytime to update it !
            </li>
            <li>
              <strong>List Known Expenses:</strong> These are usually items that remain constant from month to month. These days MOST are paid automatically. You will never have to enter these as transactions. We assume that the amounts will be spent as entered sometime during the month.
            </li>
            <li>
              <strong>Check &amp; Balance:</strong> Now you have a much better idea of how much you actually have to allocate to Daily Expenses . Check the Budget Balance and , if necessary, tinker with the amounts budgeted in Daily Expenses until its at least zero or above .
            </li>
          </ol>
        </div>
      ),
    },

    // BUDGETING & SAVINGS
    {
      id: 'faq_budgeting_1',
      category: 'budgeting',
      question: 'How do Savings Goals & Allocation Percentages work?',
      tags: ['savings', 'goals', 'target', 'percentage', 'allocation'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Savings Goals let you put aside money automatically every month for emergency funds, vacations, or major purchases.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li><strong>Target Amount:</strong> Total savings goal amount (e.g., $1,000 for Emergency Fund).</li>
            <li><strong>Current Saved:</strong> Total cash balance currently accumulated in that goal.</li>
            <li><strong>Allocation %:</strong> Percentage of monthly savings cash automatically directed to this goal during month-end reconciliation.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'faq_budgeting_2',
      category: 'budgeting',
      question: 'Why can’t I hide a Savings Goal?',
      tags: ['hide category', 'savings goal', 'rules', 'error'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            To prevent accidental loss of tracked money or broken budget math, a Savings Goal can only be hidden if <strong>all 3 fields are set to zero (0)</strong>:
          </p>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
            ⚠️ <strong>Required before hiding:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
              <li>Target Amount: <strong>$0</strong></li>
              <li>Amount Saved: <strong>$0</strong></li>
              <li>Allocation Percentage: <strong>0%</strong></li>
            </ul>
          </div>
          <p className="text-slate-400">Once these fields are cleared or transferred, click the Eye icon to hide the goal from transaction forms.</p>
        </div>
      ),
    },
    {
      id: 'faq_budgeting_3',
      category: 'budgeting',
      question: 'How do I add, edit, or customize spending categories?',
      tags: ['category', 'custom category', 'limits', 'icon', 'color'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Navigate to <strong>Settings → Categories & Limits</strong> or click <strong>Manage Categories</strong> in the Budget tab.
          </p>
          <p>
            You can create new custom categories with custom icons and colors, adjust monthly spending targets, or hide unused categories from daily entry dropdowns.
          </p>
        </div>
      ),
    },

    // MONTHLY RECONCILIATION
    {
      id: 'faq_recon_1',
      category: 'reconciliation',
      question: 'What is Monthly Reconciliation and when does it happen?',
      tags: ['reconciliation', 'end of month', 'rollover', 'closing month'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Reconciliation is LooseBudget's end-of-month wizard. On the last day of the month (or whenever manually opened), it checks your actual spending vs. planned limits.
          </p>
          <p>
            It calculates unspent discretionary funds and allows you to distribute those surplus funds into your active Savings Goals based on your configured Allocation percentages.
          </p>
        </div>
      ),
    },
    {
      id: 'faq_recon_2',
      category: 'reconciliation',
      question: 'Can I re-run reconciliation if I made a mistake or logged late expenses?',
      tags: ['rerun reconciliation', 'fix month', 'undo'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Yes! You can re-trigger reconciliation at any time from the <strong>Budget Plan</strong> tab or Settings page. LooseBudget will re-calculate month-end balances based on updated transactions.
          </p>
        </div>
      ),
    },

    // EXPENSES & BUSINESS
    {
      id: 'faq_expense_1',
      category: 'expenses',
      question: 'What is a "Business Expense" and how does it affect my budget?',
      tags: ['business', 'tax deductible', 'discretionary', 'toggle'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            When logging a transaction, toggling <strong>"Business Expense"</strong> marks it as a work/reimbursable expense.
          </p>
          <p>
            Business expenses are isolated from your personal discretionary budget limit so they don’t reduce your personal spending capacity. They are tracked separately in reports for easy export during tax season.
          </p>
        </div>
      ),
    },
    {
      id: 'faq_expense_2',
      category: 'expenses',
      question: 'Why does the app stop me from typing "savings" in daily expense notes?',
      tags: ['savings note', 'error', 'rule', 'daily expense'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            To prevent confusing daily spending (like groceries) with transfer of money into dedicated Savings Goals, standard daily expenses cannot contain the word <em>"savings"</em> in their note description.
          </p>
          <p>
            If you want to record money moved into savings, select a dedicated <strong>Savings Goal category</strong> in the category picker instead!
          </p>
        </div>
      ),
    },

    // CLOUD SYNC & PRIVACY
    {
      id: 'faq_cloud_1',
      category: 'cloud',
      question: 'Is my financial data private and secure?',
      tags: ['privacy', 'security', 'local storage', 'firestore', 'data'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            <strong>100% Private & Secure.</strong> By default, all your data stays strictly local in your web browser. LooseBudget never sells or shares financial information.
          </p>
          <p>
            If you sign in with Firebase Cloud Sync, your database documents are protected by strict security rules so only your authenticated user account can read or write your budget files.
          </p>
        </div>
      ),
    },
    {
      id: 'faq_cloud_2',
      category: 'cloud',
      question: 'How do I sync LooseBudget across multiple devices (phone, laptop, tablet)?',
      tags: ['cloud sync', 'devices', 'login', 'firebase', 'backup'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Click the <strong>Cloud Sync / Sign In</strong> button in the top header or settings menu.
          </p>
          <p>
            Once logged in with your Email account, your expenses, category targets, and savings goals synchronize seamlessly across all your devices in real-time.
          </p>
        </div>
      ),
    },
    {
      id: 'faq_cloud_3',
      category: 'cloud',
      question: 'Can I export my data or download a full backup?',
      tags: ['export', 'csv', 'json', 'backup', 'restore'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Yes! Go to <strong>Settings → Data & Backup</strong> to:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li><strong>Export CSV:</strong> Download all expenses in standard spreadsheet format for Excel / Google Sheets.</li>
            <li><strong>JSON Backup & Restore:</strong> Save a complete snapshot file of all settings, categories, and history to restore on any device.</li>
          </ul>
        </div>
      ),
    },

    // SUBSCRIPTION & TRIAL
    {
      id: 'faq_sub_1',
      category: 'subscription',
      question: 'How does the 2-Day Preview and 5-Day Bonus Free Trial work?',
      tags: ['trial', 'preview', 'subscription', 'price', 'lemon squeezy'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            Every new install starts with a <strong>2-Day Full Access Preview</strong> requiring $0 and no credit card.
          </p>
          <p>
            When you subscribe to Monthly ($1.99 CAD/mo) or Yearly ($14.99 CAD/yr), you automatically unlock an additional <strong>5-Day Bonus Free Trial</strong>. You won't be charged anything until Day 6, and you can cancel anytime with 1 click.
          </p>
        </div>
      ),
    },
    {
      id: 'faq_sub_2',
      category: 'subscription',
      question: 'What happens when my preview expires?',
      tags: ['expired', 'demo mode', 'action gated', 'paywall'],
      answer: (
        <div className="space-y-2 text-xs leading-relaxed text-slate-300">
          <p>
            If your initial preview expires, the app enters <strong>Demo / Action-Gated Mode</strong>.
          </p>
          <p>
            You can still browse your reports, view past transactions, and test calculations freely. To save new edits, add expenses, or sync across devices, simply choose a Monthly or Yearly plan to start your 5-day bonus trial.
          </p>
        </div>
      ),
    },
  ];

  // Filter FAQs based on active category and search query
  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesSearch =
        faq.question.toLowerCase().includes(query) ||
        faq.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (typeof faq.answer === 'string' && (faq.answer as string).toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackBody.trim()) return;

    const subject = encodeURIComponent(feedbackSubject.trim() || 'LooseBudget Feedback / Help Inquiry');
    const systemInfo = `\n\n--- App System Info ---\nApp Version: LooseBudget v2.4 (React)\nTimestamp: ${new Date().toISOString()}\nUser: ${user ? user.email || user.uid : 'Guest / Local'}\nTrial State: ${subscriptionState?.tier || 'trial'}\nBrowser: ${navigator.userAgent}`;
    const body = encodeURIComponent(feedbackBody.trim() + systemInfo);

    window.open(`mailto:Hmorissey@gmail.com?subject=${subject}&body=${body}`, '_blank');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 5000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12" id="tab_help">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider font-semibold">
              <HelpCircle size={14} />
              <span>Knowledge Base & Support</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              LooseBudget Help & FAQ Guide
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Find answers to Daily Expenses, Business Expenses, Savings Goals , Reconciliation, Cloud Sync and other features
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenSubscriptionModal && (
              <button
                onClick={onOpenSubscriptionModal}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Zap size={14} className="fill-current" />
                <span>Plans & Trial</span>
              </button>
            )}
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Cloud size={14} className="text-emerald-400" />
                <span>{user ? 'Cloud Account' : 'Cloud Sync'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Search Bar */}
        <div className="mt-4 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions, features, or keywords (e.g. savings goals, hide, reconciliation, trial)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 font-bold px-1.5 py-0.5 rounded bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
              activeCategory === cat.id
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Action Feature Shortcuts Grid */}
      {activeCategory === 'all' && !searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveTab('budget_plan')}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                <PieChart size={16} />
              </div>
              <ArrowRight size={14} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="font-bold text-xs text-white mb-0.5">Budget Plan</div>
            <div className="text-[11px] text-slate-400 leading-tight">Configure income, fixed bills, & target limits</div>
          </button>

          <button
            onClick={() => setActiveTab('savings')}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-pink-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 group-hover:bg-pink-500 group-hover:text-slate-950 transition-colors">
                <Target size={16} />
              </div>
              <ArrowRight size={14} className="text-slate-600 group-hover:text-pink-400 transition-colors" />
            </div>
            <div className="font-bold text-xs text-white mb-0.5">Savings Goals</div>
            <div className="text-[11px] text-slate-400 leading-tight">Manage emergency funds & allocation %</div>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors">
                <Receipt size={16} />
              </div>
              <ArrowRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="font-bold text-xs text-white mb-0.5">Transaction History</div>
            <div className="text-[11px] text-slate-400 leading-tight">Search, edit, filter, & export expenses</div>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 transition-colors">
                <Sliders size={16} />
              </div>
              <ArrowRight size={14} className="text-slate-600 group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="font-bold text-xs text-white mb-0.5">Analytics & Reports</div>
            <div className="text-[11px] text-slate-400 leading-tight">Visualize spending trends & category charts</div>
          </button>
        </div>
      )}

      {/* Main FAQ Accordion Section */}
      {activeCategory !== 'support' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <BookOpen size={14} className="text-emerald-400" />
              <span>Frequently Asked Questions ({filteredFaqs.length})</span>
            </h2>
            {searchQuery && (
              <span className="text-xs text-slate-400">
                Filtered by &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
              <HelpCircle size={32} className="mx-auto text-slate-600" />
              <div className="text-sm font-bold text-slate-300">No matching help topics found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching for a different keyword or contact developer support directly using the feedback form below.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="rounded-xl bg-slate-900/70 border border-slate-800/80 overflow-hidden transition-all hover:border-slate-700"
                  >
                    <button
                      onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <span className="font-semibold text-xs sm:text-sm text-slate-100 leading-snug">
                        {faq.question}
                      </span>
                      <div className="p-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-800/50 bg-slate-950/40 animate-in fade-in duration-150">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contact Developer & Feedback Form Section */}
      {(activeCategory === 'all' || activeCategory === 'support') && (
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <Mail size={16} />
            <span>Developer Support & Feedback</span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Have a question not answered above, found a bug, or want to request a new feature? Send a message directly to the developer.
          </p>

          <form onSubmit={handleSendFeedback} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Subject
              </label>
              <input
                type="text"
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                placeholder="Brief summary of issue or request..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Message & Details
              </label>
              <textarea
                value={feedbackBody}
                onChange={(e) => setFeedbackBody(e.target.value)}
                rows={3}
                placeholder="Describe your question or feedback..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info size={11} />
                Auto-includes app build version & system diagnostic specs.
              </span>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                {feedbackSent ? <Check size={14} /> : <Send size={14} />}
                <span>{feedbackSent ? 'Drafted in Email!' : 'Send Email to Dev'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
