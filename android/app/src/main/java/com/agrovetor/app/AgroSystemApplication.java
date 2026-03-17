package com.agrovetor.app;

import android.app.Application;
import android.os.Process;
import android.util.Log;

import com.agrovetor.app.aerial.AerialMapboxRuntime;

public class AgroSystemApplication extends Application {
    private static final String TAG = "AerialOfflineDebug";

    @Override
    public void onCreate() {
        super.onCreate();
        AerialMapboxRuntime.init(this);
        AerialMapboxRuntime.getTileStore(this);
        AerialMapboxRuntime.getOfflineManager(this);
        Log.i(TAG, "AgroSystemApplication inicializada com runtime Mapbox offline. pid=" + Process.myPid() + " (sessão fria processo novo)");
    }
}
