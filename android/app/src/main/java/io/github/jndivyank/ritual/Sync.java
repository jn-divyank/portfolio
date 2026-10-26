package io.github.jndivyank.ritual;

import android.content.Context;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Keeps the widget, notifications and reminder alarms in line with the saved data. */
final class Sync {
    private static final ExecutorService BACKGROUND = Executors.newSingleThreadExecutor();

    private Sync() {}

    static void afterChange(Context context) {
        TodayWidget.refreshAll(context);
        Reminders.clearDone(context);
        Reminders.schedule(context);
    }

    /** For saves from the app, so the page never waits on widget drawing. */
    static void afterChangeInBackground(Context context) {
        Context app = context.getApplicationContext();
        BACKGROUND.execute(() -> afterChange(app));
    }
}
