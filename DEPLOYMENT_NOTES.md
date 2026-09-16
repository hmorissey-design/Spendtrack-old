# 🚀 LooseBudget (`loosebudget.com`) - Production Deployment, Subscription & PWA Roadmap

> **Note for Future Reference:** This document details the step-by-step rollout plan for launching LooseBudget on `app.loosebudget.com`, including the $1.00 30-day trial, subscription plans, PWA phone installation, and DreamHost domain setup.

---

## 📅 Step-by-Step Rollout Order

### **Step 1: Domain & Hosting Setup (`app.loosebudget.com`)**
1. **Host Frontend:** GitHub source connected to Vercel or Google Cloud Run.
2. **DreamHost DNS Configuration (COMPLETED):**
   * `app.loosebudget.com` CNAME record added in DreamHost and fully active.
3. **Verify SSL:** HTTPS active for secure multi-device usage.

---

## 🔒 Step 2: Authentication & Subscription Model
1. **Firebase Auth Integration:**
   * Firebase Authentication & Cloud Storage enable continuous cross-device sync.
2. **Persistent Login Sessions:**
   * Persistent storage keeps users logged in seamlessly on phone and desktop.
3. **$1.00 30-Day Trial Engine:**
   * Users purchase/activate the $1.00 30-day trial via Lemon Squeezy.
   * Grants 30 full days of active cloud syncing and multi-device access.

---

## 💳 Step 3: Subscription & Billing Integration (Lemon Squeezy)
1. **Merchant of Record (Lemon Squeezy):**
   * Handles global taxes (Canadian GST/HST, US state sales tax, EU VAT) and subscriptions.
   * **Tier Options:**
     * **30-Day Trial:** $1.00 one-time
     * **Monthly Plan:** $1.99 / month
     * **Yearly Plan:** $14.99 / year (Save 37%)
2. **Paywall Gate:**
   * Users on Free Preview can view features locally. Upgrading or starting the $1 trial via Lemon Squeezy activates full multi-device cloud synchronization.

---

## 📱 Step 4: Phone App Experience (PWA & Installation)
1. **Web-Based PWA Distribution:**
   * Users visit `app.loosebudget.com` on mobile/desktop.
2. **Install Prompt (COMPLETED & VERIFIED):**
   * PWA manifest & service worker enable 1-click **Install App** / **Add to Home Screen**.
3. **Standalone App Feel:**
   * Launches full-screen without browser address bars, caches assets offline, and retains state across launches.

---

## 📋 Execution Checklist

- [x] Configure DreamHost CNAME DNS for `app.loosebudget.com` (Working & Verified)
- [x] Test PWA "Add to Home Screen" & standalone phone installation (Working & Verified)
- [x] Implement Lemon Squeezy tier options ($1.00 Trial, $1.99/mo, $14.99/yr)
- [x] Integrate Firebase Auth & Cloud Firestore profile sync
- [x] Configure Post-Trial / Subscription Paywall Modal
- [ ] Paste production Lemon Squeezy Product Checkout URLs into environment variables (`.env` / Vercel secrets)

---

## 🍋 Detailed Lemon Squeezy Account Setup Walkthrough

### **Phase 1: Account Creation & Store Approval (5–10 Minutes)**
1. Go to [lemonsqueezy.com](https://www.lemonsqueezy.com/) and click **Get Started** or **Sign Up**.
2. **Create Your Account:** Enter your email (`Hmorissey@gmail.com`) and create a secure password.
3. **Store Setup:**
   * **Store Name:** Set to `LooseBudget` or `LooseBudget Apps`.
   * **Store URL:** This will generate your store link (e.g. `loosebudget.lemonsqueezy.com`).
4. **Activate Store:**
   * Lemon Squeezy will ask for basic business/payout details (your legal name/business entity, home/business address, and banking info for payouts).
   * **Merchant of Record Advantage:** You don't need tax registration numbers in Canada/US/EU — Lemon Squeezy handles GST/HST/VAT tax collection and remittance automatically under their MOR umbrella!

---

### **Phase 2: Creating Your 3 LooseBudget Products (COMPLETED)**
All 3 products are now created in Lemon Squeezy and linked to the app:

1. **Product 1: $1.00 30-Day Trial (CREATED & LINKED)**
   * **Name:** `LooseBudget - $1 Trial (30 Days)`
   * **Checkout URL:** `https://loosebudget.lemonsqueezy.com/checkout/buy/6a55af9b-b545-40bd-a55d-9e55022abc6b`
   * **Redirect URL:** `https://app.loosebudget.com/?payment=success&plan=trial`

2. **Product 2: $1.99 / Month Subscription (CREATED & LINKED)**
   * **Name:** `Regular MonthlySubscription to LooseBudget`
   * **Pricing:** **$1.99 USD** / month (Recurring subscription).
   * **Checkout URL:** `https://loosebudget.lemonsqueezy.com/checkout/buy/82e0d56b-82f8-42d5-88c4-44c547f540d6`
   * **Redirect URL:** `https://app.loosebudget.com/?payment=success&plan=monthly`

3. **Product 3: $14.99 / Year Subscription (CREATED & LINKED)**
   * **Name:** `37% discount - Annual subscription to LooseBudget`
   * **Pricing:** **$14.99 USD** / year (Recurring subscription).
   * **Checkout URL:** `https://loosebudget.lemonsqueezy.com/checkout/buy/0be2aa11-aecf-4a78-8d2c-9e66317ab504`
   * **Redirect URL:** `https://app.loosebudget.com/?payment=success&plan=yearly`

---

### **Phase 3: Connecting Your Checkout Links to LooseBudget**
Once created, click **Share / Copy Checkout Link** on each product in Lemon Squeezy. You'll get 3 checkout URLs looking like:
`https://loosebudget.lemonsqueezy.com/buy/12345678-abcd-...`

Add these 3 URLs to your deployment environment variables (e.g., in Vercel or `.env`):
```env
VITE_LEMON_SQUEEZY_TRIAL_URL="https://loosebudget.lemonsqueezy.com/buy/YOUR_TRIAL_VARIANT_ID"
VITE_LEMON_SQUEEZY_MONTHLY_URL="https://loosebudget.lemonsqueezy.com/buy/YOUR_MONTHLY_VARIANT_ID"
VITE_LEMON_SQUEEZY_YEARLY_URL="https://loosebudget.lemonsqueezy.com/buy/YOUR_YEARLY_VARIANT_ID"
VITE_LEMON_SQUEEZY_STORE_URL="https://loosebudget.lemonsqueezy.com/my-orders"
```
When a user taps **"Activate $1.00 Trial"**, **"Get Monthly"**, or **"Get Yearly"** in LooseBudget, it opens their secure checkout instantly!

---

## 🤖 Step 5: Android APK Build & Native Auto-Detection

### **Why an APK?**
Web browsers (PWAs) cannot listen to background OS notifications due to Android browser sandboxes. Packaging LooseBudget as an Android APK (using Capacitor) unlocks:
1. **Zero-Setup Background Capture:** `WalletNotificationService` catches Google Wallet tap-to-pay, Samsung Wallet, and banking notifications automatically.
2. **1-Tap Permission:** Replaces all complex webhooks and third-party tools with a single Android Settings toggle.
3. **Smart 5-Minute Deduplication:** Prevents double-counting when both Google Wallet and your bank send simultaneous alerts for a single transaction.
4. **Direct Website Distribution:** Distributed directly from `loosebudget.com` as an APK download, bypassing Google Play's 30% cut and retaining Lemon Squeezy billing.
5. **Seamless Cross-Device Sync:** Mobile APK and Desktop web use the exact same Firebase Auth and Firestore backend, synchronizing transactions instantly.

### **Automated APK Build via GitHub Actions**
When you push code to GitHub:
- `/.github/workflows/build-apk.yml` builds `app-release-unsigned.apk` automatically under your repository's **Actions** tab.
- Download the APK, host it on your landing page (e.g. `loosebudget.com/download/loosebudget.apk`), and users can install it on any Android device!




