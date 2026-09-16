package com.loosebudget.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "WalletBridge")
public class WalletBridgePlugin extends Plugin {
    private static final String TAG = "WalletBridgePlugin";
    private static WalletBridgePlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void notifyNewTransaction(JSONObject tx) {
        if (instance != null) {
            try {
                JSObject jsObj = JSObject.fromJSONObject(tx);
                instance.notifyListeners("transactionDetected", jsObj);
            } catch (Exception e) {
                Log.e(TAG, "Failed to emit transactionDetected: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void isNotificationAccessGranted(PluginCall call) {
        Context context = getContext();
        String pkgName = context.getPackageName();
        String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        boolean isEnabled = false;

        if (!TextUtils.isEmpty(flat)) {
            String[] names = flat.split(":");
            for (String name : names) {
                ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && TextUtils.equals(pkgName, cn.getPackageName())) {
                    isEnabled = true;
                    break;
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("granted", isEnabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open notification settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingTransactions(PluginCall call) {
        try {
            JSONArray array = WalletNotificationService.getAndClearPendingTransactions(getContext());
            JSArray jsArray = new JSArray();
            for (int i = 0; i < array.length(); i++) {
                jsArray.put(JSObject.fromJSONObject(array.getJSONObject(i)));
            }
            JSObject ret = new JSObject();
            ret.put("transactions", jsArray);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error fetching pending transactions: " + e.getMessage());
        }
    }
}
