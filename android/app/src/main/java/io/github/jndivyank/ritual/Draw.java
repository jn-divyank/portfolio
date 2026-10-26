package io.github.jndivyank.ritual;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

/** Bitmaps for the widget: the day wheel and per-habit check circles, styled like the app. */
final class Draw {
    // Neutral greys with alpha, so the same bitmap reads on light and dark widget backgrounds.
    private static final int TRACK = 0x33888888;
    private static final int RING = 0x66888888;

    private Draw() {}

    /** One arc per habit, filled by its progress (wheelSVG() in tracker/app.js). */
    static Bitmap wheel(float density, int sizeDp, int[] colors, float[] progress) {
        int size = Math.round(sizeDp * density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float c = size / 2f;
        float r = c * 48f / 59f; // the app draws r = 48 with an 11 stroke in a 118 box
        float stroke = r * 11f / 48f;
        RectF oval = new RectF(c - r, c - r, c + r, c + r);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setStrokeCap(Paint.Cap.ROUND);

        int n = colors.length;
        if (n == 0) {
            paint.setColor(TRACK);
            canvas.drawCircle(c, c, r, paint);
            return bitmap;
        }
        double circumference = 2 * Math.PI * r;
        double segment = circumference / n;
        double gap = n > 1 ? Math.min(stroke + r * 6 / 48, segment * 0.45) : 0;
        float sweep = (float) ((segment - gap) / circumference * 360);
        for (int i = 0; i < n; i++) {
            float start = (float) (-90 + (i * segment + gap / 2) / circumference * 360);
            paint.setColor(TRACK);
            canvas.drawArc(oval, start, sweep, false, paint);
            if (progress[i] > 0) {
                paint.setColor(colors[i]);
                canvas.drawArc(oval, start, sweep * progress[i], false, paint);
            }
        }
        return bitmap;
    }

    /** Filled with a tick when done; otherwise a ring, with progress and a plus for counters. */
    static Bitmap check(float density, int sizeDp, int color, int onColor, float progress, boolean done,
                        boolean counter) {
        int size = Math.round(sizeDp * density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float c = size / 2f;
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);

        if (done) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(color);
            canvas.drawCircle(c, c, c, paint);
            Path tick = new Path();
            tick.moveTo(size * 0.29f, size * 0.52f);
            tick.lineTo(size * 0.44f, size * 0.66f);
            tick.lineTo(size * 0.72f, size * 0.37f);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(size * 0.1f);
            paint.setColor(onColor);
            canvas.drawPath(tick, paint);
            return bitmap;
        }

        float stroke = size * 0.085f;
        float r = c - stroke / 2f - 0.5f;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setColor(RING);
        canvas.drawCircle(c, c, r, paint);
        if (progress > 0) {
            paint.setColor(color);
            canvas.drawArc(new RectF(c - r, c - r, c + r, c + r), -90, 360 * progress, false, paint);
        }
        if (counter) {
            float arm = size * 0.17f;
            paint.setColor(color);
            canvas.drawLine(c - arm, c, c + arm, c, paint);
            canvas.drawLine(c, c - arm, c, c + arm, paint);
        }
        return bitmap;
    }
}
