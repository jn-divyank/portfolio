package io.github.jndivyank.ritual;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** State JSON shaped exactly like the web app writes it (JSON.stringify of normalize()). */
final class Fixtures {
    static final LocalDate MONDAY = LocalDate.of(2026, 10, 26);

    static String habit(String id, String name, String type, int target, String unit, String days,
                        String createdAt, String reminder) {
        return "{\"id\":\"" + id + "\",\"name\":\"" + name + "\",\"icon\":\"sparkles\",\"color\":\"sky\","
                + "\"type\":\"" + type + "\",\"target\":" + target + ",\"unit\":\"" + unit + "\","
                + "\"days\":" + days + ",\"createdAt\":\"" + createdAt + "\","
                + "\"reminder\":" + (reminder == null ? "null" : "\"" + reminder + "\"") + "}";
    }

    static String state(String logs, String... habits) {
        return "{\"version\":1,\"habits\":[" + String.join(",", habits) + "],\"logs\":" + logs
                + ",\"settings\":{\"theme\":\"system\",\"weekStart\":1,\"haptics\":true}}";
    }

    /** Water (count 8, every day, 08:00), Work out (weekdays, 18:30), Read (starts Tuesday). */
    static String week() {
        return state("{\"2026-10-26\":{\"w\":3}}",
                habit("w", "Drink water", "count", 8, "glasses", "[0,1,2,3,4,5,6]", "2026-10-01", "08:00"),
                habit("g", "Work out", "check", 1, "", "[1,2,3,4,5]", "2026-10-01", "18:30"),
                habit("r", "Read", "check", 1, "", "[0,1,2,3,4,5,6]", "2026-10-27", null));
    }

    static long millis(LocalDateTime time) {
        return time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private Fixtures() {}
}
