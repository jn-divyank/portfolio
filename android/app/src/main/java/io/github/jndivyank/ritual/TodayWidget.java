package io.github.jndivyank.ritual;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Home-screen widget: today's wheel and habits, with tap-to-check circles. */
public class TodayWidget extends AppWidgetProvider {
    static final String ACTION_TAP = "io.github.jndivyank.ritual.WIDGET_TAP";
    static final String EXTRA_HABIT = "habit";
    static final String EXTRA_DAY = "day";

    private static final int ROW_DP = 44;
    private static final int CHROME_DP = 14 * 2 + 44 + 6; // padding, header, gap above the rows

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int id : widgetIds) manager.updateAppWidget(id, build(context, manager, id));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int widgetId, Bundle options) {
        manager.updateAppWidget(widgetId, build(context, manager, widgetId));
    }

    @Override
    public void onEnabled(Context context) {
        Reminders.schedule(context); // also arms the after-midnight refresh
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_TAP.equals(intent.getAction())) {
            super.onReceive(context, intent);
            return;
        }
        String habit = intent.getStringExtra(EXTRA_HABIT);
        String day = intent.getStringExtra(EXTRA_DAY);
        // A widget still showing yesterday just refreshes instead of logging the wrong day.
        if (habit != null && Habits.key(LocalDate.now()).equals(day)) {
            Store.edit(context, state -> Habits.tap(state, habit, day));
        }
        Sync.afterChange(context);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        for (int id : manager.getAppWidgetIds(new ComponentName(context, TodayWidget.class))) {
            manager.updateAppWidget(id, build(context, manager, id));
        }
    }

    static RemoteViews build(Context context, AppWidgetManager manager, int widgetId) {
        String pkg = context.getPackageName();
        float density = context.getResources().getDisplayMetrics().density;
        RemoteViews views = new RemoteViews(pkg, R.layout.widget_today);
        PendingIntent open = Reminders.openApp(context);
        views.setOnClickPendingIntent(R.id.widget_header, open);
        views.setOnClickPendingIntent(R.id.widget_message, open);
        views.removeAllViews(R.id.widget_rows);

        JSONObject state = Store.load(context);
        LocalDate today = LocalDate.now();
        String key = Habits.key(today);
        List<Habits.Habit> habits = state == null ? new ArrayList<>() : Habits.scheduledOn(state, today);

        int message = 0;
        if (state == null || Habits.all(state).isEmpty()) message = R.string.widget_empty;
        else if (habits.isEmpty()) message = R.string.widget_rest;
        views.setViewVisibility(R.id.widget_message, message == 0 ? View.GONE : View.VISIBLE);
        if (message != 0) views.setTextViewText(R.id.widget_message, context.getString(message));

        int[] colors = new int[habits.size()];
        float[] progress = new float[habits.size()];
        List<Habits.Habit> pending = new ArrayList<>();
        List<Habits.Habit> done = new ArrayList<>();
        for (int i = 0; i < habits.size(); i++) {
            Habits.Habit h = habits.get(i);
            colors[i] = Habits.color(h.color);
            progress[i] = Habits.progress(state, h, key);
            (Habits.isDone(state, h, key) ? done : pending).add(h);
        }
        views.setImageViewBitmap(R.id.widget_wheel, Draw.wheel(density, 44, colors, progress));
        views.setTextViewText(R.id.widget_count, habits.isEmpty() ? "" : String.valueOf(done.size()));
        views.setTextViewText(R.id.widget_subtitle, habits.isEmpty() ? ""
                : done.size() == habits.size() ? context.getString(R.string.widget_perfect)
                : context.getString(R.string.widget_progress, done.size(), habits.size()));

        // What's left first, so a small widget shows what still needs doing.
        List<Habits.Habit> ordered = new ArrayList<>(pending);
        ordered.addAll(done);
        int capacity = rowCapacity(context, manager, widgetId);
        int shown = ordered.size() <= capacity ? ordered.size() : Math.max(1, capacity - 1);
        for (Habits.Habit h : ordered.subList(0, shown)) {
            views.addView(R.id.widget_rows, row(context, state, h, key, density, open));
        }
        int hidden = ordered.size() - shown;
        views.setViewVisibility(R.id.widget_more, hidden > 0 ? View.VISIBLE : View.GONE);
        if (hidden > 0) views.setTextViewText(R.id.widget_more, context.getString(R.string.widget_more, hidden));
        return views;
    }

    private static RemoteViews row(Context context, JSONObject state, Habits.Habit h, String key, float density,
                                   PendingIntent open) {
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
        int count = Habits.count(state, h.id, key);
        boolean done = Habits.isDone(state, h, key);
        row.setTextViewText(R.id.row_name, h.name);
        if (h.count) {
            row.setTextViewText(R.id.row_meta, count + " / " + h.target + (h.unit.isEmpty() ? "" : " " + h.unit));
            row.setViewVisibility(R.id.row_meta, View.VISIBLE);
        }
        row.setImageViewBitmap(R.id.row_check, Draw.check(density, 26, Habits.color(h.color),
                Habits.onColor(h.color), Habits.progress(state, h, key), done, h.count));
        int label = h.count ? R.string.widget_add_one : done ? R.string.widget_undo : R.string.widget_mark;
        row.setContentDescription(R.id.row_check, context.getString(label, h.name));

        Intent tap = new Intent(context, TodayWidget.class)
                .setAction(ACTION_TAP)
                .setData(Uri.parse("ritual://widget/" + Uri.encode(h.id)))
                .putExtra(EXTRA_HABIT, h.id)
                .putExtra(EXTRA_DAY, key);
        row.setOnClickPendingIntent(R.id.row_check, PendingIntent.getBroadcast(context, 0, tap,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        row.setOnClickPendingIntent(R.id.row_body, open);
        return row;
    }

    private static int rowCapacity(Context context, AppWidgetManager manager, int widgetId) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        // Launchers report the portrait height as MAX_HEIGHT and the landscape one as MIN_HEIGHT.
        boolean landscape = context.getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        int height = options == null ? 0 : options.getInt(landscape
                ? AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT : AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
        if (height <= 0) return 4;
        return Math.max(1, (height - CHROME_DP) / ROW_DP);
    }
}
