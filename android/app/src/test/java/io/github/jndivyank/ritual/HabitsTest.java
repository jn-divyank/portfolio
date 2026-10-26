package io.github.jndivyank.ritual;

import static io.github.jndivyank.ritual.Fixtures.MONDAY;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class HabitsTest {
    private static List<String> ids(List<Habits.Habit> habits) {
        List<String> ids = new ArrayList<>();
        for (Habits.Habit h : habits) ids.add(h.id);
        return ids;
    }

    @Test
    public void schedulesByWeekdayAndStartDate() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        assertEquals(List.of("w", "g"), ids(Habits.scheduledOn(s, MONDAY)));
        assertEquals(List.of("w"), ids(Habits.scheduledOn(s, MONDAY.minusDays(1)))); // Sunday
        assertEquals(List.of("w", "g", "r"), ids(Habits.scheduledOn(s, MONDAY.plusDays(1))));
    }

    @Test
    public void emptyDaysMeansEveryDay() throws Exception {
        JSONObject s = new JSONObject(Fixtures.state("{}",
                Fixtures.habit("x", "X", "check", 1, "", "[]", "2026-01-01", null)));
        assertEquals(1, Habits.scheduledOn(s, MONDAY.minusDays(1)).size());
    }

    @Test
    public void tapTogglesCheckOffAndCountsUp() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        String key = Habits.key(MONDAY);
        Habits.tap(s, "g", key);
        assertEquals(1, Habits.count(s, "g", key));
        Habits.tap(s, "g", key);
        assertEquals(0, Habits.count(s, "g", key));
        Habits.tap(s, "w", key);
        assertEquals(4, Habits.count(s, "w", key));
    }

    @Test
    public void undoingTheLastCheckInRemovesTheDay() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        String key = Habits.key(MONDAY.plusDays(1));
        Habits.tap(s, "g", key);
        Habits.tap(s, "g", key);
        assertFalse(s.getJSONObject("logs").has(key));
    }

    @Test
    public void notificationActionNeverUndoes() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        String key = Habits.key(MONDAY);
        assertTrue(Habits.advance(s, "g", key));
        assertFalse(Habits.advance(s, "g", key));
        assertEquals(1, Habits.count(s, "g", key));
        assertTrue(Habits.advance(s, "w", key));
        assertEquals(4, Habits.count(s, "w", key));
    }

    @Test
    public void editsKeepFieldsTheNativeSideDoesNotKnow() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        s.put("futureFeature", new JSONObject().put("kept", true));
        Habits.tap(s, "g", Habits.key(MONDAY));
        JSONObject again = new JSONObject(s.toString());
        assertTrue(again.getJSONObject("futureFeature").getBoolean("kept"));
        assertTrue(again.getJSONArray("habits").getJSONObject(0).has("icon"));
    }

    @Test
    public void nextReminderHonoursScheduleAndOrder() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        ZoneId zone = ZoneId.systemDefault();
        assertEquals(Fixtures.millis(MONDAY.atTime(18, 30)),
                Habits.nextReminder(s, MONDAY.atTime(9, 0), zone));
        assertEquals(Fixtures.millis(MONDAY.plusDays(1).atTime(8, 0)),
                Habits.nextReminder(s, MONDAY.atTime(19, 0), zone));
        // Friday evening: the weekday workout is skipped, Saturday's water reminder is next.
        assertEquals(Fixtures.millis(MONDAY.plusDays(5).atTime(8, 0)),
                Habits.nextReminder(s, MONDAY.plusDays(4).atTime(19, 0), zone));
    }

    @Test
    public void noRemindersMeansNoAlarm() throws Exception {
        JSONObject s = new JSONObject(Fixtures.state("{}",
                Fixtures.habit("x", "X", "check", 1, "", "[0,1,2,3,4,5,6]", "2026-01-01", null)));
        assertEquals(-1, Habits.nextReminder(s, MONDAY.atTime(9, 0), ZoneId.systemDefault()));
    }

    @Test
    public void dueSkipsHabitsAlreadyDone() throws Exception {
        JSONObject s = new JSONObject(Fixtures.week());
        assertEquals(List.of("w"), ids(Habits.dueAt(s, MONDAY.atTime(8, 0))));
        Habits.setCount(s, "w", Habits.key(MONDAY), 8);
        assertTrue(Habits.dueAt(s, MONDAY.atTime(8, 0)).isEmpty());
    }
}
