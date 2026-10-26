package io.github.jndivyank.ritual;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Habit reminders. A single alarm is kept for the next reminder time across all habits; when it
 * fires, every habit due then that isn't done yet gets a notification, and the next one is set.
 */
final class Reminders {
    static final String ACTION_FIRE = "io.github.jndivyank.ritual.REMINDER";
    static final String ACTION_ADVANCE = "io.github.jndivyank.ritual.ADVANCE";
    static final String ACTION_NEW_DAY = "io.github.jndivyank.ritual.NEW_DAY";
    static final String EXTRA_TIME = "time";
    static final String EXTRA_HABIT = "habit";
    static final String EXTRA_DAY = "day";

    private static final String CHANNEL = "reminders";
    private static final int ACCENT = 0xFFFF5B2E;
    private static final long WINDOW = 10 * 60_000L;

    private Reminders() {}

    /** Sets (or clears) the alarm for the next reminder, plus the just-after-midnight refresh. */
    static void schedule(Context context) {
        scheduleAfter(context, System.currentTimeMillis());
    }

    static void scheduleAfter(Context context, long afterMillis) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        ZoneId zone = ZoneId.systemDefault();
        LocalDateTime after = LocalDateTime.ofInstant(Instant.ofEpochMilli(afterMillis), zone);

        JSONObject state = Store.load(context);
        long next = state == null ? -1 : Habits.nextReminder(state, after, zone);
        if (next < 0) {
            alarms.cancel(broadcast(context, new Intent(ACTION_FIRE), 1));
        } else {
            PendingIntent fire = broadcast(context, new Intent(ACTION_FIRE).putExtra(EXTRA_TIME, next), 1);
            if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, fire);
            } else {
                alarms.setWindow(AlarmManager.RTC_WAKEUP, next, WINDOW, fire);
            }
        }

        // The widget shows "today", so it needs a refresh when the date changes. No need to
        // wake the phone for it: a non-wakeup alarm runs when the screen next comes on.
        long midnight = after.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
        alarms.setWindow(AlarmManager.RTC, midnight + 30_000, WINDOW,
                broadcast(context, new Intent(ACTION_NEW_DAY), 2));
    }

    /** The alarm went off: notify for habits due at that time, then set the next alarm. */
    static void onAlarm(Context context, long time) {
        JSONObject state = Store.load(context);
        if (state != null && notificationsAllowed(context)) {
            LocalDateTime slot = LocalDateTime.ofInstant(Instant.ofEpochMilli(time), ZoneId.systemDefault());
            for (Habits.Habit h : Habits.dueAt(state, slot)) show(context, state, h, slot.toLocalDate());
        }
        scheduleAfter(context, Math.max(time, System.currentTimeMillis()));
    }

    /** "Done" / "+1" tapped on a notification. */
    static void onAdvance(Context context, String habitId, String key) {
        Store.edit(context, state -> Habits.advance(state, habitId, key));
        JSONObject state = Store.load(context);
        Habits.Habit h = state == null ? null : Habits.find(state, habitId);
        if (h == null || Habits.isDone(state, h, key)) {
            notifications(context).cancel(notificationId(habitId));
        } else {
            show(context, state, h, LocalDate.parse(key)); // counter: update "3 of 8"
        }
    }

    /** Clears notifications for habits that are now done today (e.g. checked off in the app). */
    static void clearDone(Context context) {
        JSONObject state = Store.load(context);
        if (state == null) return;
        LocalDate today = LocalDate.now();
        String key = Habits.key(today);
        NotificationManager manager = notifications(context);
        for (Habits.Habit h : Habits.scheduledOn(state, today)) {
            if (Habits.isDone(state, h, key)) manager.cancel(notificationId(h.id));
        }
    }

    static boolean notificationsAllowed(Context context) {
        return notifications(context).areNotificationsEnabled();
    }

    static void show(Context context, JSONObject state, Habits.Habit h, LocalDate day) {
        if (!notificationsAllowed(context)) return;
        NotificationManager manager = notifications(context);
        manager.createNotificationChannel(new NotificationChannel(
                CHANNEL, context.getString(R.string.reminders_channel), NotificationManager.IMPORTANCE_DEFAULT));

        String key = Habits.key(day);
        String text;
        if (h.count) {
            int n = Habits.count(state, h.id, key);
            text = context.getString(R.string.reminder_count, n, h.target, h.unit.isEmpty() ? "" : " " + h.unit);
        } else {
            text = context.getString(R.string.reminder_check);
        }

        Intent advance = new Intent(ACTION_ADVANCE)
                .setData(Uri.parse("ritual://habit/" + Uri.encode(h.id)))
                .putExtra(EXTRA_HABIT, h.id)
                .putExtra(EXTRA_DAY, key);
        Notification notification = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_ritual)
                .setColor(ACCENT)
                .setContentTitle(h.name)
                .setContentText(text)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openApp(context))
                .addAction(new Notification.Action.Builder(null,
                        context.getString(h.count ? R.string.action_plus_one : R.string.action_done),
                        broadcast(context, advance, 0)).build())
                .build();
        manager.notify(notificationId(h.id), notification);
    }

    static PendingIntent openApp(Context context) {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        return PendingIntent.getActivity(context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent broadcast(Context context, Intent intent, int requestCode) {
        intent.setClass(context, ReminderReceiver.class);
        return PendingIntent.getBroadcast(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static int notificationId(String habitId) {
        return habitId.hashCode();
    }

    private static NotificationManager notifications(Context context) {
        return context.getSystemService(NotificationManager.class);
    }
}
