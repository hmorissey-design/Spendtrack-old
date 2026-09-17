var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "loosebudget-5edf8",
  appId: "1:410589318670:web:a4f3dc80c87e6d86e9365f",
  apiKey: "AIzaSyAivYrsocXyLbqxa3ZC0UhTPRRAk0ul89I",
  authDomain: "loosebudget-5edf8.firebaseapp.com",
  storageBucket: "loosebudget-5edf8.firebasestorage.app",
  messagingSenderId: "410589318670"
};

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
var firebaseApp = !(0, import_app.getApps)().length ? (0, import_app.initializeApp)(firebase_applet_config_default) : (0, import_app.getApp)();
var db = (0, import_firestore.getFirestore)(firebaseApp);
app.use(import_express.default.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.post("/api/lemon-squeezy-webhook", async (req, res) => {
  try {
    const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "CoverdaleCancun";
    const signature = req.headers["x-signature"];
    if (webhookSecret && signature) {
      const hmac = import_crypto.default.createHmac("sha256", webhookSecret);
      const digest = Buffer.from(hmac.update(req.rawBody).digest("hex"), "utf8");
      const signatureBuffer = Buffer.from(Array.isArray(signature) ? signature[0] : signature, "utf8");
      if (digest.length !== signatureBuffer.length || !import_crypto.default.timingSafeEqual(digest, signatureBuffer)) {
        console.warn("\u26A0\uFE0F Invalid Lemon Squeezy Webhook Signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }
    const payload = req.body;
    const meta = payload?.meta || {};
    const eventName = meta.event_name;
    const data = payload?.data || {};
    const attributes = data.attributes || {};
    const rawEmail = attributes.user_email || attributes.customer_email || attributes.order_user_email;
    if (!rawEmail) {
      console.log(`\u2139\uFE0F Webhook event '${eventName}' received without user email.`);
      return res.status(200).json({ status: "ignored_no_email" });
    }
    const email = String(rawEmail).toLowerCase().trim();
    const isCancelled = eventName === "subscription_cancelled" || eventName === "subscription_expired";
    const status = isCancelled ? "cancelled" : "active";
    const variantName = String(attributes.variant_name || "").toLowerCase();
    const itemName = String(attributes.first_order_item?.variant_name || "").toLowerCase();
    const tier = variantName.includes("monthly") || itemName.includes("monthly") ? "monthly" : "yearly";
    console.log(`\u26A1 Processing Lemon Squeezy Webhook: '${eventName}' for ${email} (Status: ${status}, Tier: ${tier})`);
    const subRef = (0, import_firestore.doc)(db, "subscriptions", email);
    await (0, import_firestore.setDoc)(subRef, {
      email,
      status,
      tier,
      eventName: eventName || "order_created",
      orderId: String(data.id || attributes.order_id || ""),
      updatedAt: Date.now()
    }, { merge: true });
    return res.status(200).json({ success: true, email, status, tier });
  } catch (error) {
    console.error("\u274C Error handling Lemon Squeezy Webhook:", error);
    return res.status(500).json({ error: "Internal server error processing webhook" });
  }
});
app.post("/api/check-subscription-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const subRef = (0, import_firestore.doc)(db, "subscriptions", normalizedEmail);
    const snap = await (0, import_firestore.getDoc)(subRef);
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
  } catch (error) {
    console.error("\u274C Error checking subscription by email:", error);
    return res.status(500).json({ error: "Failed to query subscription status" });
  }
});
var pendingNotificationsQueue = [];
function serverParseNotificationText(text, sourceHint) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const data = JSON.parse(trimmed);
      const amount = parseFloat(data.amount || data.value || data.total);
      const vendor2 = data.vendor || data.merchant || data.payee || data.name;
      if (!isNaN(amount) && amount > 0 && vendor2) {
        return {
          vendor: String(vendor2).trim(),
          amount: Math.abs(amount),
          currency: data.currency || "$",
          date: data.date || today,
          source: data.source || sourceHint || "apple_wallet",
          appName: data.appName || "Wallet Webhook"
        };
      }
    } catch (e) {
    }
  }
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
  const amountRegex = /(?:(\$|USD|CAD|EUR|GBP|€|£)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(\$|USD|CAD|EUR|GBP|€|£))/i;
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
    const fallbackNum = trimmed.match(/\b(\d+(?:\.\d{2}))\b/);
    if (fallbackNum) rawAmount = parseFloat(fallbackNum[1]);
  }
  if (isNaN(rawAmount) || rawAmount <= 0) return null;
  let rawVendor = "";
  const linesOrParts = trimmed.split(/[\n\r]+|:\s+|\s+-\s+|\s+•\s+/);
  if (linesOrParts.length >= 2) {
    const firstPart = linesOrParts[0].trim();
    const isFirstGeneric = /^(google wallet|google pay|apple pay|apple wallet|samsung pay|samsung wallet|messages|sms|transaction alert)$/i.test(firstPart);
    if (!isFirstGeneric && firstPart.length >= 2 && !firstPart.match(/\$\d+|\b\d+\.\d{2}\b/)) {
      rawVendor = firstPart;
    } else if (isFirstGeneric && linesOrParts.length >= 3) {
      const secondPart = linesOrParts[1].trim();
      if (secondPart.length >= 2 && !secondPart.match(/\$\d+|\b\d+\.\d{2}\b/)) {
        rawVendor = secondPart;
      }
    }
  }
  if (!rawVendor) {
    const atMatch = trimmed.match(/\bat\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:on|with|for|using|via|card|ending|\d{4})|\.|\,|$|\n)/i);
    if (atMatch && atMatch[1]?.trim()) rawVendor = atMatch[1];
  }
  if (!rawVendor) {
    const toMatch = trimmed.match(/(?:paid|sent|transfer(?:red)? to)\s+(?:(?:\$|\w+)?\s*\d+(?:\.\d{2})?\s*(?:to\s+)?)?([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:with|using|on|via|from)|\.|\,|$|\n)/i);
    if (toMatch && toMatch[1]?.trim()) rawVendor = toMatch[1];
  }
  if (!rawVendor) {
    const fromMatch = trimmed.match(/(?:charge|transaction|purchase)\s+from\s+([A-Za-z0-9\s'&.*#\-]+?)(?:\s+(?:for|on|with|via)|\.|\,|$|\n)/i);
    if (fromMatch && fromMatch[1]?.trim()) rawVendor = fromMatch[1];
  }
  if (!rawVendor) {
    const preAmountMatch = trimmed.match(/^([A-Za-z0-9\s'&.*#\-]{2,40}?)\s+(?:\$|USD|CAD|EUR|GBP|€|£)?\s*\d+(?:\.\d{2})?\s+with\b/i);
    if (preAmountMatch && preAmountMatch[1]?.trim()) {
      const candidate = preAmountMatch[1].trim();
      if (!/^(transaction|purchase|charge|payment|alert)$/i.test(candidate)) {
        rawVendor = candidate;
      }
    }
  }
  if (!rawVendor) {
    const bankCardMatch = trimmed.match(/on\s+your\s+([A-Za-z0-9\s'&.*#\-]+?)\s+(?:ending in|ending with|\d{4}|on\s+\w+)/i);
    if (bankCardMatch && bankCardMatch[1]?.trim()) rawVendor = bankCardMatch[1];
  }
  let vendor = rawVendor.replace(/^["'“”‘’«»`:\-•\s]+|["'“”‘’«»`:\-•\s]+$/g, "").trim();
  vendor = vendor.replace(/^(sq\s*\*|tst\s*\*|sp\s*\*|paypal\s*\*|amzn\s*mktp\s*\*)/i, "").trim();
  vendor = vendor.replace(/^(google wallet|google pay|apple pay|apple wallet|samsung pay|samsung wallet|messages|sms|transaction alert)\s*[:\-•]\s*/i, "").trim();
  vendor = vendor.replace(/#\s*\d+/g, "").trim();
  vendor = vendor.replace(/^["'“”‘’«»`:\-•\s]+|["'“”‘’«»`:\-•\s]+$/g, "").trim();
  const vLower = vendor.toLowerCase();
  if (!vendor || vendor.length < 2 || vLower === "merchant" || vLower === "unknown merchant" || vLower === "google wallet" || vLower === "apple pay" || vLower === "samsung wallet" || vLower === "messages" || vLower.includes("card ending") || vLower.includes("fraud alert") || vLower.includes("account balance")) {
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
app.post("/api/notifications/ingest", (req, res) => {
  try {
    const payload = req.body || {};
    const rawText = String(payload.text || payload.message || payload.notification || req.query.text || "").trim();
    const token = String(payload.token || req.query.token || req.headers["x-sync-token"] || "").trim();
    const sourceHint = String(payload.source || req.query.source || "");
    let parsedItem = null;
    if (payload.amount && (payload.vendor || payload.merchant)) {
      parsedItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        vendor: String(payload.vendor || payload.merchant).trim(),
        amount: Math.abs(parseFloat(payload.amount)),
        currency: String(payload.currency || "$"),
        date: String(payload.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]),
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
    pendingNotificationsQueue.unshift(parsedItem);
    if (pendingNotificationsQueue.length > 50) {
      pendingNotificationsQueue.pop();
    }
    console.log(`\u{1F4F1} Ingested Notification: ${parsedItem.vendor} ($${parsedItem.amount}) via ${parsedItem.source}`);
    return res.status(200).json({
      success: true,
      notification: parsedItem
    });
  } catch (error) {
    console.error("\u274C Error ingesting notification:", error);
    return res.status(500).json({ error: "Internal server error ingesting notification" });
  }
});
app.get("/api/notifications/pending", (req, res) => {
  const token = String(req.query.token || req.headers["x-sync-token"] || "").trim();
  const items = token ? pendingNotificationsQueue.filter((item) => !item.token || item.token === token) : pendingNotificationsQueue;
  return res.status(200).json({
    count: items.length,
    notifications: items
  });
});
app.post("/api/notifications/ack", (req, res) => {
  const { id } = req.body || {};
  if (id) {
    const idx = pendingNotificationsQueue.findIndex((item) => item.id === id);
    if (idx !== -1) {
      pendingNotificationsQueue.splice(idx, 1);
    }
  }
  return res.status(200).json({ success: true });
});
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} LooseBudget Server running on http://0.0.0.0:${PORT}`);
  });
}
start();
//# sourceMappingURL=server.cjs.map
