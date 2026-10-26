package io.github.jndivyank.ritual;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.test.core.app.ApplicationProvider;

import org.json.JSONArray;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import java.io.File;
import java.util.concurrent.atomic.AtomicInteger;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class StoreTest {
    private final Context context = ApplicationProvider.getApplicationContext();

    @After
    public void tearDown() {
        Store.setListener(null);
    }

    @Test
    public void startsEmptyAndRoundTrips() {
        assertEquals("", Store.read(context));
        assertTrue(Store.write(context, Fixtures.week()));
        assertEquals(Fixtures.week(), Store.read(context));
    }

    @Test
    public void outsideEditsTellTheOpenAppToReload() {
        AtomicInteger reloads = new AtomicInteger();
        Store.setListener(reloads::incrementAndGet);
        Store.write(context, Fixtures.week());
        assertTrue(Store.edit(context, s -> Habits.tap(s, "g", "2026-10-26")));
        assertEquals(1, reloads.get());
        assertTrue(Store.read(context).contains("\"g\":1"));
    }

    @Test
    public void neverWritesOverDataItCannotRead() {
        Store.write(context, "{not json");
        assertFalse(Store.edit(context, s -> Habits.tap(s, "g", "2026-10-26")));
        assertEquals("{not json", Store.read(context));
    }

    @Test
    public void keepsTheFiveNewestRescueCopies() throws Exception {
        for (int i = 0; i < 7; i++) {
            assertTrue(Store.saveRescue(context, "copy " + i, "ritual-unreadable-2026-10-2" + i + "T10-00-00-000Z.json"));
        }
        JSONArray names = new JSONArray(Store.listRescues(context));
        assertEquals(5, names.length());
        assertEquals("ritual-unreadable-2026-10-26T10-00-00-000Z.json", names.getString(0));
        assertEquals("copy 6", Store.readRescue(context, names.getString(0)));
    }

    @Test
    public void rescueNamesStayInsideTheRescueFolder() {
        assertTrue(Store.saveRescue(context, "x", "../../escape.json"));
        assertFalse(new File(context.getFilesDir().getParentFile(), "escape.json").exists());
        assertFalse(new File(context.getFilesDir(), "escape.json").exists());
    }
}
