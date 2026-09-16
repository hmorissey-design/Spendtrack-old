package com.loosebudget.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WalletBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
