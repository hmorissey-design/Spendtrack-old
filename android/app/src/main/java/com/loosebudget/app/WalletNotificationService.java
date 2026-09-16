package com.loosebudget.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class WalletNotificationService extends NotificationListenerService {
    private static final String TAG = "LooseBudgetWalletSync";
    private static final String PREFS_NAME = "loosebudget_wallet_prefs";
    private static final String KEY_PENDING_TX = "pending_transactions";

    // Known financial and wallet packages
    private static final String PKG_GOOGLE_WALLET = "com.google.android.apps.walletnfcrel";
    private static final String PKG_SAMSUNG_PAY = "com.samsung.android.spay";
    private static final String PKG_SAMSUNG_WALLET = "com.samsung.android.raja.snote";

    // Regular expressions for transaction extraction
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(\\$|CAD|USD|EUR|GBP|€|£)\\s*([0-9]+(?:\\.[0-9]{2})?)");
    private static final Pattern ALT_AMOUNT_PATTERN = Pattern.compile("([0-9]+(?:\\.[0-9]{2})?)\\s*(\\$|CAD|USD|EUR|GBP|€|£)");

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        try {
            String packageName = sbn.getPackageName();
            Bundle extras = sbn.getNotification().extras;
            if (extras == null) return;

            CharSequence titleChar = extras.getCharSequence("android.title");
            CharSequence textChar = extras.getCharSequence("android.text");
            CharSequence bigTextChar = extras.getCharSequence("android.bigText");

            String title = titleChar != null ? titleChar.toString() : "";
            String text = textChar != null ? textChar.toString() : "";
            if (bigTextChar != null && bigTextChar.length() > text.length()) {
                text = bigTextChar.toString();
            }

            String fullText = (title + " " + text).trim();
            if (fullText.isEmpty()) return;

            // Determine if this is a financial notification
            String source = detectWalletSource(packageName, fullText);
            if (source == null) {
                // Not a recognized financial package, check if content has financial transaction keywords
                if (!isFinancialText(fullText)) {
                    return;
                }
                source = "bank_app";
            }

            // Extract amount
            Double amount = extractAmount(fullText);
            if (amount == null || amount <= 0.0) {
                return; // No valid dollar amount found
            }

            // Extract merchant name
            String vendor = extractVendor(fullText, title, source);

            // Create transaction JSON
            JSONObject tx = new JSONObject();
            tx.put("id", "android_" + System.currentTimeMillis() + "_" + Math.round(Math.random() * 1000));
            tx.put("vendor", vendor);
            tx.put("amount", amount);
            tx.put("currency", "$");
            tx.put("source", source);
            tx.put("packageName", packageName);
            tx.put("rawText", fullText);
            tx.put("timestamp", System.currentTimeMillis());

            Log.i(TAG, "Transaction detected: " + vendor + " - $" + amount + " [" + source + "]");

            // Save to SharedPreferences queue
            savePendingTransaction(getApplicationContext(), tx);

            // If the app is currently running in the foreground, notify plugin directly
            WalletBridgePlugin.notifyNewTransaction(tx);

        } catch (Exception e) {
            Log.e(TAG, "Error processing notification: " + e.getMessage(), e);
        }
    }

    private String detectWalletSource(String pkg, String text) {
        if (pkg.contains("walletnfcrel") || pkg.contains("google.android.apps.wallet")) {
            return "google_wallet";
        }
        if (pkg.contains("samsung.android.spay")) {
            return "samsung_wallet";
        }
        if (pkg.contains("messaging") || pkg.contains("mms") || pkg.contains("sms")) {
            return "sms_bank";
        }
        if (pkg.contains("chase") || pkg.contains("citi") || pkg.contains("wellsfargo") ||
            pkg.contains("rbc") || pkg.contains("td") || pkg.contains("bmo") ||
            pkg.contains("scotiabank") || pkg.contains("cibc") || pkg.contains("capitalone") ||
            pkg.contains("monzo") || pkg.contains("revolut")) {
            return "bank_app";
        }
        return null;
    }

    private boolean isFinancialText(String text) {
        String lower = text.toLowerCase();
        boolean hasAmount = lower.contains("$") || lower.contains("usd") || lower.contains("cad") || lower.contains("eur");
        boolean hasKeyword = lower.contains("purchase") || lower.contains("paid") || lower.contains("spent") ||
                             lower.contains("card ending") || lower.contains("transaction") || lower.contains("charge") ||
                             lower.contains("authorized") || lower.contains("debit");
        return hasAmount && hasKeyword;
    }

    private Double extractAmount(String text) {
        Matcher m1 = AMOUNT_PATTERN.matcher(text);
        if (m1.find()) {
            try {
                return Double.parseDouble(m1.group(2));
            } catch (Exception ignored) {}
        }
        Matcher m2 = ALT_AMOUNT_PATTERN.matcher(text);
        if (m2.find()) {
            try {
                return Double.parseDouble(m2.group(1));
            } catch (Exception ignored) {}
        }
        return null;
    }

    private String extractVendor(String text, String title, String source) {
        // Try pattern: "at [Merchant]"
        Pattern atPattern = Pattern.compile("\\bat\\s+([^,.!\\n\\r0-9]+)", Pattern.CASE_INSENSITIVE);
        Matcher m = atPattern.matcher(text);
        if (m.find()) {
            String v = m.group(1).trim();
            if (v.length() > 1 && v.length() < 50) return cleanVendor(v);
        }

        // Try pattern: "paid to [Merchant]"
        Pattern toPattern = Pattern.compile("\\b(paid|sent)\\s+(?:to\\s+)?([^,.!\\n\\r0-9]+)", Pattern.CASE_INSENSITIVE);
        Matcher m2 = toPattern.matcher(text);
        if (m2.find()) {
            String v = m2.group(2).trim();
            if (v.length() > 1 && v.length() < 50) return cleanVendor(v);
        }

        // Try pattern: "charge from [Merchant]"
        Pattern fromPattern = Pattern.compile("\\bcharge(?:\\s+from)?\\s+([^,.!\\n\\r0-9]+)", Pattern.CASE_INSENSITIVE);
        Matcher m3 = fromPattern.matcher(text);
        if (m3.find()) {
            String v = m3.group(1).trim();
            if (v.length() > 1 && v.length() < 50) return cleanVendor(v);
        }

        if (title != null && !title.isEmpty() && !title.equalsIgnoreCase("Google Wallet") && !title.equalsIgnoreCase("Samsung Pay")) {
            return cleanVendor(title);
        }

        return "Retail Store";
    }

    private String cleanVendor(String raw) {
        String cleaned = raw.replaceAll("(?i)^(sq\\s*\\*|tst\\s*\\*|sp\\s*\\*|paypal\\s*\\*)", "");
        cleaned = cleaned.replaceAll("#\\s*\\d+", "");
        cleaned = cleaned.replaceAll("(?i)\\b(store|loc|terminal)\\s*#?\\s*\\d+", "");
        cleaned = cleaned.replaceAll("(?i)\\b(llc|inc|corp|ltd|co)\\b", "");
        cleaned = cleaned.replaceAll("[_\\-*#]+", " ");
        cleaned = cleaned.trim();
        return cleaned.isEmpty() ? "Retail Store" : cleaned;
    }

    private static synchronized void savePendingTransaction(Context context, JSONObject tx) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(KEY_PENDING_TX, "[]");
            JSONArray array = new JSONArray(existingJson);
            array.put(tx);
            prefs.edit().putString(KEY_PENDING_TX, array.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error saving pending transaction: " + e.getMessage());
        }
    }

    public static synchronized JSONArray getAndClearPendingTransactions(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(KEY_PENDING_TX, "[]");
            JSONArray array = new JSONArray(existingJson);
            prefs.edit().putString(KEY_PENDING_TX, "[]").apply();
            return array;
        } catch (Exception e) {
            return new JSONArray();
        }
    }
}
