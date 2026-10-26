package io.github.jndivyank.ritual;

import static io.github.jndivyank.ritual.Fixtures.MONDAY;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;

import androidx.test.core.app.ApplicationProvider;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;
import org.robolectric.shadows.ShadowNotificationManager;

import java.util.List;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class RemindersTest {
    private final Context context = ApplicationProvider.getApplicationContext();
    private ShadowAlarmManager alarms;
    private ShadowNotificationManager notifications;

    @Before
    public void setUp() {
        Store.write(context, Fixtures.week());
        alarms = shadowOf(context.getSystemService(AlarmManager.class));
        notifications = shadowOf(context.getSystemService(NotificationManager.class));
    }

    @After
    public void tearDown() {
        ShadowAlarmManager.setCanScheduleExactAlarms(false);
    }

    private ShadowAlarmManager.ScheduledAlarm alarmOfType(int type) {
        for (ShadowAlarmManager.ScheduledAlarm a : alarms.getScheduledAlarms()) if (a.getType() == type) return a;
        throw new AssertionError("no alarm of type " + type);
    }

    @Test
    public void setsAnExactAlarmForTheNextReminder() {
        ShadowAlarmManager.setCanScheduleExactAlarms(true);
        Reminders.scheduleAfter(context, Fixtures.millis(MONDAY.atTime(9, 0)));
        ShadowAlarmManager.ScheduledAlarm next = alarmOfType(AlarmManager.RTC_WAKEUP);
        assertEquals(Fixtures.millis(MONDAY.atTime(18, 30)), next.getTriggerAtMs());
        assertTrue(next.allowWhileIdle);
        // And a quiet refresh just after midnight for the widget.
        assertEquals(Fixtures.millis(MONDAY.plusDays(1).atStartOfDay()) + 30_000,
                alarmOfType(AlarmManager.RTC).getTriggerAtMs());
    }

    @Test
    public void fallsBackToATenMinuteWindowWithoutExactAlarms() {
        ShadowAlarmManager.setCanScheduleExactAlarms(false);
        Reminders.scheduleAfter(context, Fixtures.millis(MONDAY.atTime(9, 0)));
        ShadowAlarmManager.ScheduledAlarm next = alarmOfType(AlarmManager.RTC_WAKEUP);
        assertEquals(Fixtures.millis(MONDAY.atTime(18, 30)), next.getTriggerAtMs());
        assertEquals(10 * 60_000L, next.getWindowLengthMs());
    }

    @Test
    public void remindsAboutUnfinishedCounters() {
        Reminders.onAlarm(context, Fixtures.millis(MONDAY.atTime(8, 0)));
        List<Notification> shown = notifications.getAllNotifications();
        assertEquals(1, shown.size());
        Notification n = shown.get(0);
        assertEquals("Drink water", n.extras.getString(Notification.EXTRA_TITLE));
        assertEquals("3 of 8 glasses so far", n.extras.getCharSequence(Notification.EXTRA_TEXT).toString());
        assertEquals("+1", n.actions[0].title.toString());
    }

    @Test
    public void staysQuietWhenTheHabitIsAlreadyDone() throws Exception {
        Store.edit(context, s -> {
            Habits.setCount(s, "w", "2026-10-26", 8);
            return true;
        });
        Reminders.onAlarm(context, Fixtures.millis(MONDAY.atTime(8, 0)));
        assertEquals(0, notifications.size());
    }

    @Test
    public void doneActionChecksOffAndClearsTheNotification() {
        Reminders.onAlarm(context, Fixtures.millis(MONDAY.atTime(18, 30)));
        assertEquals(1, notifications.size());
        assertEquals("Done", notifications.getAllNotifications().get(0).actions[0].title.toString());
        Reminders.onAdvance(context, "g", "2026-10-26");
        assertTrue(Store.read(context).contains("\"g\":1"));
        assertEquals(0, notifications.size());
    }

    @Test
    public void plusOneUpdatesTheCounterNotification() {
        Reminders.onAlarm(context, Fixtures.millis(MONDAY.atTime(8, 0)));
        Reminders.onAdvance(context, "w", "2026-10-26");
        assertEquals(1, notifications.size());
        assertEquals("4 of 8 glasses so far",
                notifications.getAllNotifications().get(0).extras.getCharSequence(Notification.EXTRA_TEXT).toString());
    }
}
