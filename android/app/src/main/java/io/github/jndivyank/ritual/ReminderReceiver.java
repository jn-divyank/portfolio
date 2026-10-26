package io.github.jndivyank.ritual;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Reminder alarms, notification actions, and the system events that clear or shift alarms. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        switch (action) {
            case Reminders.ACTION_FIRE:
                Reminders.onAlarm(context, intent.getLongExtra(Reminders.EXTRA_TIME, System.currentTimeMillis()));
                break;
            case Reminders.ACTION_ADVANCE: {
                String habit = intent.getStringExtra(Reminders.EXTRA_HABIT);
                String day = intent.getStringExtra(Reminders.EXTRA_DAY);
                if (habit == null || day == null) return;
                Reminders.onAdvance(context, habit, day);
                Sync.afterChange(context);
                break;
            }
            case Reminders.ACTION_NEW_DAY:
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
            case Intent.ACTION_TIME_CHANGED:
            case Intent.ACTION_TIMEZONE_CHANGED:
                Sync.afterChange(context);
                break;
            default:
                break;
        }
    }
}
