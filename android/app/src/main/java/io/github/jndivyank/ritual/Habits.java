package io.github.jndivyank.ritual;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads and updates the web app's state JSON for the widget and reminders. Mirrors the rules in
 * tracker/lib.js and tracker/app.js (scheduling, "done", count goals); keep the two in step.
 */
final class Habits {
    static final class Habit {
        String id;
        String name;
        String color;
        boolean count;
        int target;
        String unit;
        String createdAt;
        LocalTime reminder;
        /** Indexed like JavaScript's Date#getDay(): 0 = Sunday. */
        final boolean[] days = new boolean[7];
    }

    // Same palette as COLORS in tracker/app.js.
    private static final String[] COLOR_IDS =
            {"coral", "orange", "amber", "green", "teal", "sky", "blue", "violet", "pink", "graphite"};
    private static final int[] COLOR_VALUES = {
            0xFFFF5D5D, 0xFFFF8A34, 0xFFFFC22E, 0xFF34C77B, 0xFF2EC4B6,
            0xFF38B6FF, 0xFF4C7DFF, 0xFF8B6CFF, 0xFFFF5FA2, 0xFF8E8E93,
    };

    private Habits() {}

    static List<Habit> all(JSONObject state) {
        List<Habit> list = new ArrayList<>();
        JSONArray habits = state.optJSONArray("habits");
        if (habits == null) return list;
        for (int i = 0; i < habits.length(); i++) {
            JSONObject o = habits.optJSONObject(i);
            if (o == null || o.optString("id").isEmpty()) continue;
            Habit h = new Habit();
            h.id = o.optString("id");
            h.name = o.optString("name");
            h.color = o.optString("color", "coral");
            h.count = "count".equals(o.optString("type"));
            h.target = h.count ? Math.max(1, o.optInt("target", 1)) : 1;
            h.unit = h.count ? o.optString("unit") : "";
            h.createdAt = o.optString("createdAt", "0000-00-00");
            // Missing or empty means every day, as in normalize() in app.js.
            JSONArray days = o.optJSONArray("days");
            boolean everyDay = days == null || days.length() == 0;
            for (int d = 0; d < 7; d++) h.days[d] = everyDay;
            if (!everyDay) {
                for (int j = 0; j < days.length(); j++) {
                    int d = days.optInt(j, -1);
                    if (d >= 0 && d < 7) h.days[d] = true;
                }
            }
            String reminder = o.isNull("reminder") ? "" : o.optString("reminder");
            if (!reminder.isEmpty()) {
                try {
                    h.reminder = LocalTime.parse(reminder);
                } catch (DateTimeParseException ignored) {
                    // No reminder rather than a wrong one.
                }
            }
            list.add(h);
        }
        return list;
    }

    static String key(LocalDate day) {
        return day.toString(); // ISO yyyy-MM-dd, same as dateKey() in lib.js
    }

    static boolean isScheduled(Habit h, LocalDate day) {
        return key(day).compareTo(h.createdAt) >= 0 && h.days[day.getDayOfWeek().getValue() % 7];
    }

    static List<Habit> scheduledOn(JSONObject state, LocalDate day) {
        List<Habit> list = new ArrayList<>();
        for (Habit h : all(state)) if (isScheduled(h, day)) list.add(h);
        return list;
    }

    static int count(JSONObject state, String habitId, String key) {
        JSONObject logs = state.optJSONObject("logs");
        JSONObject entries = logs == null ? null : logs.optJSONObject(key);
        return entries == null ? 0 : entries.optInt(habitId, 0);
    }

    static boolean isDone(JSONObject state, Habit h, String key) {
        return count(state, h.id, key) >= h.target;
    }

    static float progress(JSONObject state, Habit h, String key) {
        return Math.min(1f, count(state, h.id, key) / (float) h.target);
    }

    static void setCount(JSONObject state, String habitId, String key, int n) throws JSONException {
        JSONObject logs = state.optJSONObject("logs");
        if (logs == null) {
            logs = new JSONObject();
            state.put("logs", logs);
        }
        JSONObject entries = logs.optJSONObject(key);
        if (n > 0) {
            if (entries == null) {
                entries = new JSONObject();
                logs.put(key, entries);
            }
            entries.put(habitId, n);
        } else if (entries != null) {
            entries.remove(habitId);
            if (entries.length() == 0) logs.remove(key);
        }
    }

    /** A tap on the widget: check-off habits toggle, counters go up by one. */
    static boolean tap(JSONObject state, String habitId, String key) throws JSONException {
        Habit h = find(state, habitId);
        if (h == null) return false;
        int n = count(state, h.id, key);
        setCount(state, h.id, key, h.count ? n + 1 : (n >= h.target ? 0 : h.target));
        return true;
    }

    /** The notification action: "Done" for check-off habits, "+1" for counters. Never undoes. */
    static boolean advance(JSONObject state, String habitId, String key) throws JSONException {
        Habit h = find(state, habitId);
        if (h == null) return false;
        int n = count(state, h.id, key);
        if (!h.count && n >= h.target) return false;
        setCount(state, h.id, key, h.count ? n + 1 : h.target);
        return true;
    }

    static Habit find(JSONObject state, String habitId) {
        for (Habit h : all(state)) if (h.id.equals(habitId)) return h;
        return null;
    }

    /** The next reminder strictly after {@code after}, in epoch millis, or -1 if none. */
    static long nextReminder(JSONObject state, LocalDateTime after, ZoneId zone) {
        LocalDateTime best = null;
        List<Habit> habits = all(state);
        for (int offset = 0; offset <= 7; offset++) {
            LocalDate day = after.toLocalDate().plusDays(offset);
            for (Habit h : habits) {
                if (h.reminder == null || !isScheduled(h, day)) continue;
                LocalDateTime at = day.atTime(h.reminder);
                if (at.isAfter(after) && (best == null || at.isBefore(best))) best = at;
            }
            if (best != null) break; // later days can't be earlier
        }
        return best == null ? -1 : best.atZone(zone).toInstant().toEpochMilli();
    }

    /** Habits whose reminder is at {@code slot}, scheduled that day, and not done yet. */
    static List<Habit> dueAt(JSONObject state, LocalDateTime slot) {
        List<Habit> due = new ArrayList<>();
        LocalDate day = slot.toLocalDate();
        LocalTime time = slot.toLocalTime().withSecond(0).withNano(0);
        for (Habit h : all(state)) {
            if (time.equals(h.reminder) && isScheduled(h, day) && !isDone(state, h, key(day))) due.add(h);
        }
        return due;
    }

    static int color(String id) {
        for (int i = 0; i < COLOR_IDS.length; i++) if (COLOR_IDS[i].equals(id)) return COLOR_VALUES[i];
        return COLOR_VALUES[0];
    }

    /** Check-mark colour on a filled circle: dark on amber, white elsewhere. */
    static int onColor(String id) {
        return "amber".equals(id) ? 0xFF231A00 : 0xFFFFFFFF;
    }
}
