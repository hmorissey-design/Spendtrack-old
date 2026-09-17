import express from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Firebase Server Instance
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(firebaseApp);

// Middleware for parsing raw JSON body to verify webhook signature
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// API Route: Lemon Squeezy Webhook Receiver
app.post("/api/lemon-squeezy-webhook", async (req: any, res: any) => {
  try {
    const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || 'CoverdaleCancun';
    const signature = req.headers["x-signature"];

    // Validate Signature if secret is configured
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac("sha256", webhookSecret);
      const digest = Buffer.from(hmac.update(req.rawBody).digest("hex"), "utf8");
      const signatureBuffer = Buffer.from(Array.isArray(signature) ? signature[0] : signature, "utf8");

      if (digest.length !== signatureBuffer.length || !crypto.timingSafeEqual(digest, signatureBuffer)) {
        console.warn("⚠️ Invalid Lemon Squeezy Webhook Signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const payload = req.body;
    const meta = payload?.meta || {};
    const eventName = meta.event_name;
    const data = payload?.data || {};
    const attributes = data.attributes || {};

    // Get customer email from attributes
    const rawEmail = attributes.user_email || attributes.customer_email || attributes.order_user_email;
    if (!rawEmail) {
      console.log(`ℹ️ Webhook event '${eventName}' received without user email.`);
      return res.status(200).json({ status: "ignored_no_email" });
    }

    const email = String(rawEmail).toLowerCase().trim();
    const isCancelled = eventName === "subscription_cancelled" || eventName === "subscription_expired";
    const status = isCancelled ? "cancelled" : "active";
    
    // Determine plan tier (monthly vs yearly)
    const variantName = String(attributes.variant_name || "").toLowerCase();
    const itemName = String(attributes.first_order_item?.variant_name || "").toLowerCase();
    const tier = (variantName.includes("monthly") || itemName.includes("monthly")) ? "monthly" : "yearly";

    console.log(`⚡ Processing Lemon Squeezy Webhook: '${eventName}' for ${email} (Status: ${status}, Tier: ${tier})`);

    // Store in Firestore: subscriptions/{email}
    const subRef = doc(db, "subscriptions", email);
    await setDoc(subRef, {
      email,
      status,
      tier,
      eventName: eventName || "order_created",
      orderId: String(data.id || attributes.order_id || ""),
      updatedAt: Date.now(),
    }, { merge: true });

    return res.status(200).json({ success: true, email, status, tier });
  } catch (error: any) {
    console.error("❌ Error handling Lemon Squeezy Webhook:", error);
    return res.status(500).json({ error: "Internal server error processing webhook" });
  }
});

// API Route: Direct Email Subscription Lookup (Restore PRO Status)
app.post("/api/check-subscription-email", async (req: any, res: any) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const subRef = doc(db, "subscriptions", normalizedEmail);
    const snap = await getDoc(subRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "active") {
        return res.status(200).json({
          found: true,
          isSubscribed: true,
          tier: data.tier || "yearly",
          email: normalizedEmail,
          updatedAt: data.updatedAt
        });
      }
    }

    return res.status(200).json({
      found: false,
      isSubscribed: false,
      email: normalizedEmail
    });
  } catch (error: any) {
    console.error("❌ Error checking subscription by email:", error);
    return res.status(500).json({ error: "Failed to query subscription status" });
  }
});

// In-memory queue for incoming notifications from iOS Shortcuts / Android Tasker / Webhooks
interface IngestedNotificationItem {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  source: string;
  appName: string;
  rawText: string;
  token?: string;
  receivedAt: number;
}

const pendingNotificationsQueue: IngestedNotificationItem[] = [];

// Helper parser for server-side webhook payloads
function serverParseNotificationText(text: string, sourceHint?: string) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const today = new Date().toISOString().split("T")[0];

  // Check if JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const data = JSON.parse(trimmed);
      const amount = parseFloat(data.amount || data.value || data.total);
      const vendor = data.vendor || data.merchant || data.payee || data.name;
      if (!isNaN(amount) && amount > 0 && vendor) {
        return {
          vendor: String(vendor).trim(),
          amount: Math.abs(amount),
          currency: data.currency || "$",
          date: data.date || today,
          source: data.source || sourceHint || "apple_wallet",
          appName: data.appName || "Wallet Webhook"
        };
      }
    } catch (e) {}
  }

  // Detect source
  let source = sourceHint || "digital_wallet";
  let appName = "Wallet Notification";
  const lower = trimmed.toLowerCase();
  if (lower.includes("google wallet") || lower.includes("google pay") || lower.includes("gpay")) {
    source = "google_wallet";
    appName = "Google Wallet";
  } else if (lower.includes("apple wallet") || lower.includes("apple pay") || lower.includes("apple card")) {
    source = "apple_wallet";
    appName = "Apple Wallet";
  } else if (lower.includes("samsung wallet") || lower.includes("samsung pay")) {
    source = "samsung_wallet";
    appName = "Samsung Wallet";
  }

  // Extract amount
  const amountRegex = /(?:(\$|USD|CAD|EUR|GBP|€|£)\s*(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s*(\$|USD|CAD|EUR|GBP|€|£))/i;
  const amountMatch = trimmed.match(amountRegex);
  let rawAmount = 0;
  let currency = "$";

  if (amountMatch) {
    if (amountMatch[2]) {
      currency = amountMatch[1];
      rawAmount = parseFloat(amountMatch[2].replace(",", "."));
    } else if (amountMatch[3]) {
      currency = amountMatch[4];
      rawAmount = parseFloat(amountMatch[3].replace(",", "."));
    }
  } else {
    const fallbackNum = trimmed.match(/\b(\d+\.\d{2})\b/);
    if (fallbackNum) rawAmount = parseFloat(fallbackNum[1]);
  }

  if (isNaN(rawAmount) || rawAmount <= 0) return null;

  // Extract vendor
  let rawVendor = "";
  const atMatch = trimmed.match(/(?:at|with)\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+on|\s+with|\s+for|\s+using|\s+card|\s+ending|\.|\,|$)/i);
  const toMatch = trimmed.match(/(?:paid|sent|transfer(?:red)? to)\s+(?:(?:\$|\w+)?\s*\d+(?:\.\d{2})?\s*(?:to\s+)?)?([A-Za-z0-9\s'&.*#\-]+?)(?:\s+with|\s+using|\s+on|\s+from|\.|\,|$)/i);
  const fromMatch = trimmed.match(/(?:charge|transaction|purchase)\s+from\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+for|\s+on|\.|\,|$)/i);
  const prefixMatch = trimmed.match(/(?:Google Wallet|Google Pay|Apple Pay|Samsung Pay|Samsung Wallet):\s*(?:Paid\s*)?([A-Za-z0-9\s'&.*#\-]+?)(?:\s+for|\s+\$|\s*\d|\.|\,|$)/i);

  if (atMatch && atMatch[1]?.trim()) {
    rawVendor = atMatch[1];
  } else if (toMatch && toMatch[1]?.trim()) {
    rawVendor = toMatch[1];
  } else if (fromMatch && fromMatch[1]?.trim()) {
    rawVendor = fromMatch[1];
  } else if (prefixMatch && prefixMatch[1]?.trim()) {
    rawVendor = prefixMatch[1];
  } else {
    return null; // Require an explicit vendor
  }

  // Strip quotation marks and clean prefixes
  let vendor = rawVendor.replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, "").trim();
  vendor = vendor.replace(/^(sq\s*\*|tst\s*\*|sp\s*\*|paypal\s*\*|amzn\s*mktp\s*\*)/i, "").trim();
  vendor = vendor.replace(/#\s*\d+/g, "").trim();
  vendor = vendor.replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, "").trim();

  const vLower = vendor.toLowerCase();
  if (
    !vendor ||
    vendor.length < 2 ||
    vLower === "merchant" ||
    vLower === "unknown merchant" ||
    vLower.includes("transaction") ||
    vLower.includes("occurred") ||
    vLower.includes("card ending") ||
    vLower.includes("fraud") ||
    vLower.includes("authorized") ||
    vLower.includes("alert")
  ) {
    return null;
  }

  return {
    vendor,
    amount: rawAmount,
    currency: currency || "$",
    date: today,
    source,
    appName
  };
}

// API Route: Ingest notification from iOS Shortcuts, Android Tasker, or webhook
app.post("/api/notifications/ingest", (req: any, res: any) => {
  try {
    const payload = req.body || {};
    const rawText = String(payload.text || payload.message || payload.notification || req.query.text || "").trim();
    const token = String(payload.token || req.query.token || req.headers["x-sync-token"] || "").trim();
    const sourceHint = String(payload.source || req.query.source || "");

    let parsedItem: IngestedNotificationItem | null = null;

    if (payload.amount && (payload.vendor || payload.merchant)) {
      // Structured payload
      parsedItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        vendor: String(payload.vendor || payload.merchant).trim(),
        amount: Math.abs(parseFloat(payload.amount)),
        currency: String(payload.currency || "$"),
        date: String(payload.date || new Date().toISOString().split("T")[0]),
        source: String(payload.source || "other_app"),
        appName: String(payload.appName || "Webhook"),
        rawText: rawText || `Direct webhook for ${payload.vendor}: $${payload.amount}`,
        token,
        receivedAt: Date.now()
      };
    } else if (rawText) {
      const parsed = serverParseNotificationText(rawText, sourceHint);
      if (parsed) {
        parsedItem = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          vendor: parsed.vendor,
          amount: parsed.amount,
          currency: parsed.currency,
          date: parsed.date,
          source: parsed.source,
          appName: parsed.appName,
          rawText,
          token,
          receivedAt: Date.now()
        };
      }
    }

    if (!parsedItem) {
      return res.status(400).json({
        error: "Could not detect a valid transaction amount and vendor in the provided text or payload.",
        receivedText: rawText
      });
    }

    // Push into queue, keep last 50
    pendingNotificationsQueue.unshift(parsedItem);
    if (pendingNotificationsQueue.length > 50) {
      pendingNotificationsQueue.pop();
    }

    console.log(`📱 Ingested Notification: ${parsedItem.vendor} ($${parsedItem.amount}) via ${parsedItem.source}`);
    return res.status(200).json({
      success: true,
      notification: parsedItem
    });
  } catch (error: any) {
    console.error("❌ Error ingesting notification:", error);
    return res.status(500).json({ error: "Internal server error ingesting notification" });
  }
});

// API Route: Poll pending ingested notifications
app.get("/api/notifications/pending", (req: any, res: any) => {
  const token = String(req.query.token || req.headers["x-sync-token"] || "").trim();
  const items = token
    ? pendingNotificationsQueue.filter(item => !item.token || item.token === token)
    : pendingNotificationsQueue;

  return res.status(200).json({
    count: items.length,
    notifications: items
  });
});

// API Route: Acknowledge / clear notification
app.post("/api/notifications/ack", (req: any, res: any) => {
  const { id } = req.body || {};
  if (id) {
    const idx = pendingNotificationsQueue.findIndex(item => item.id === id);
    if (idx !== -1) {
      pendingNotificationsQueue.splice(idx, 1);
    }
  }
  return res.status(200).json({ success: true });
});

// Vite Middleware & Static File Handling
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 LooseBudget Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
