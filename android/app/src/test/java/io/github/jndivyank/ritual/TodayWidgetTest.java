package io.github.jndivyank.ritual;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.test.core.app.ApplicationProvider;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAppWidgetManager;

import java.time.LocalDate;

/**
 * Creates the widget through the AppWidgetManager, so the RemoteViews are inflated the way a
 * launcher would; a view that isn't allowed in widgets fails here instead of on the phone.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class TodayWidgetTest {
    private final Context context = ApplicationProvider.getApplicationContext();
    private final AppWidgetManager manager = AppWidgetManager.getInstance(context);
    private final ShadowAppWidgetManager shadowManager = shadowOf(manager);
    private final String today = Habits.key(LocalDate.now());

    private void saveThreeHabits() {
        Store.write(context, Fixtures.state("{\"" + today + "\":{\"a\":1,\"b\":5}}",
                Fixtures.habit("a", "Stretch", "check", 1, "", "[0,1,2,3,4,5,6]", "2020-01-01", null),
                Fixtures.habit("b", "Drink water", "count", 8, "glasses", "[0,1,2,3,4,5,6]", "2020-01-01", null),
                Fixtures.habit("c", "Read", "check", 1, "", "[0,1,2,3,4,5,6]", "2020-01-01", null)));
    }

    private static String text(View root, int id) {
        return ((TextView) root.findViewById(id)).getText().toString();
    }

    @Test
    public void showsTodayWithWhatIsLeftFirst() {
        saveThreeHabits();
        int id = shadowManager.createWidget(TodayWidget.class, R.layout.widget_today);
        View root = shadowManager.getViewFor(id);
        assertEquals("1", text(root, R.id.widget_count));
        assertEquals("1 of 3 done", text(root, R.id.widget_subtitle));
        ViewGroup rows = root.findViewById(R.id.widget_rows);
        assertEquals(3, rows.getChildCount());
        assertEquals("Drink water", text(rows.getChildAt(0), R.id.row_name));
        assertEquals("5 / 8 glasses", text(rows.getChildAt(0), R.id.row_meta));
        assertEquals("Read", text(rows.getChildAt(1), R.id.row_name));
        assertEquals("Stretch", text(rows.getChildAt(2), R.id.row_name));
        assertEquals(View.GONE, root.findViewById(R.id.widget_more).getVisibility());
    }

    @Test
    public void shortWidgetsSummariseTheRest() {
        saveThreeHabits();
        int id = shadowManager.createWidget(TodayWidget.class, R.layout.widget_today);
        Bundle options = new Bundle();
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 14 * 2 + 44 + 6 + 44 * 2);
        manager.updateAppWidgetOptions(id, options);
        manager.updateAppWidget(id, TodayWidget.build(context, manager, id));
        View root = shadowManager.getViewFor(id);
        assertEquals(1, ((ViewGroup) root.findViewById(R.id.widget_rows)).getChildCount());
        assertEquals("+2 more", text(root, R.id.widget_more));
    }

    @Test
    public void invitesYouToStartWhenThereAreNoHabits() {
        int id = shadowManager.createWidget(TodayWidget.class, R.layout.widget_today);
        View root = shadowManager.getViewFor(id);
        assertEquals(View.VISIBLE, root.findViewById(R.id.widget_message).getVisibility());
        assertEquals("Open Ritual to add your first habit.", text(root, R.id.widget_message));
        assertEquals(0, ((ViewGroup) root.findViewById(R.id.widget_rows)).getChildCount());
    }

    @Test
    public void tappingACircleChecksItOffForToday() {
        saveThreeHabits();
        tap("c", today);
        assertTrue(Store.read(context).contains("\"c\":1"));
    }

    @Test
    public void aTapOnYesterdaysWidgetChangesNothing() {
        saveThreeHabits();
        String before = Store.read(context);
        tap("c", Habits.key(LocalDate.now().minusDays(1)));
        assertEquals(before, Store.read(context));
        assertFalse(Store.read(context).contains("\"c\":1"));
    }

    private void tap(String habit, String day) {
        new TodayWidget().onReceive(context, new Intent(TodayWidget.ACTION_TAP)
                .putExtra(TodayWidget.EXTRA_HABIT, habit)
                .putExtra(TodayWidget.EXTRA_DAY, day));
    }
}
