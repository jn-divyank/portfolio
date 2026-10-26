package io.github.jndivyank.ritual;

import android.content.Context;
import android.util.AtomicFile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * The app's data, as the same JSON the web app keeps. One file shared by the app, the widget
 * and reminders. Writes are atomic, so a crash mid-write never leaves a half-written file.
 */
final class Store {
    /** Told about writes made outside the open app (widget taps, notification actions). */
    interface Listener {
        void onExternalChange();
    }

    /** Mutates parsed state; return false to leave the file untouched. */
    interface Edit {
        boolean apply(JSONObject state) throws JSONException;
    }

    private static final String FILE = "ritual-state.json";
    private static final String RESCUE_DIR = "rescue";
    private static final int MAX_RESCUES = 5;
    private static final Object LOCK = new Object();

    private static volatile Listener listener;

    private Store() {}

    static void setListener(Listener l) {
        listener = l;
    }

    /** The saved JSON, or "" if there is none yet. */
    static String read(Context context) {
        synchronized (LOCK) {
            AtomicFile file = file(context);
            if (!file.getBaseFile().exists()) return "";
            try {
                return new String(file.readFully(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                return "";
            }
        }
    }

    static boolean write(Context context, String json) {
        synchronized (LOCK) {
            AtomicFile file = file(context);
            FileOutputStream out = null;
            try {
                out = file.startWrite();
                out.write(json.getBytes(StandardCharsets.UTF_8));
                file.finishWrite(out);
                return true;
            } catch (IOException e) {
                if (out != null) file.failWrite(out);
                return false;
            }
        }
    }

    /** Parsed state, or null when there is none or it can't be read (never guess at it). */
    static JSONObject load(Context context) {
        String raw = read(context);
        if (raw.isEmpty()) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException e) {
            return null;
        }
    }

    /** Read-modify-write from outside the app; the open app (if any) is told to reload. */
    static boolean edit(Context context, Edit edit) {
        boolean changed;
        synchronized (LOCK) {
            JSONObject state = load(context);
            if (state == null) return false;
            try {
                changed = edit.apply(state) && write(context, state.toString());
            } catch (JSONException e) {
                return false;
            }
        }
        Listener l = listener;
        if (changed && l != null) l.onExternalChange();
        return changed;
    }

    static boolean saveRescue(Context context, String raw, String name) {
        synchronized (LOCK) {
            File dir = new File(context.getFilesDir(), RESCUE_DIR);
            if (!dir.isDirectory() && !dir.mkdirs()) return false;
            AtomicFile file = new AtomicFile(new File(dir, safeName(name)));
            FileOutputStream out = null;
            try {
                out = file.startWrite();
                out.write(raw.getBytes(StandardCharsets.UTF_8));
                file.finishWrite(out);
            } catch (IOException e) {
                if (out != null) file.failWrite(out);
                return false;
            }
            File[] all = rescues(dir);
            for (int i = MAX_RESCUES; i < all.length; i++) all[i].delete();
            return true;
        }
    }

    /** Rescue file names as a JSON array, newest first. */
    static String listRescues(Context context) {
        synchronized (LOCK) {
            JSONArray names = new JSONArray();
            for (File f : rescues(new File(context.getFilesDir(), RESCUE_DIR))) names.put(f.getName());
            return names.toString();
        }
    }

    static String readRescue(Context context, String name) {
        synchronized (LOCK) {
            AtomicFile file = new AtomicFile(new File(new File(context.getFilesDir(), RESCUE_DIR), safeName(name)));
            try {
                return new String(file.readFully(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                return "";
            }
        }
    }

    private static File[] rescues(File dir) {
        File[] files = dir.listFiles((d, n) -> n.endsWith(".json"));
        if (files == null) return new File[0];
        // Names carry an ISO timestamp, so reverse name order is newest first.
        Arrays.sort(files, (a, b) -> b.getName().compareTo(a.getName()));
        return files;
    }

    private static String safeName(String name) {
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static AtomicFile file(Context context) {
        return new AtomicFile(new File(context.getFilesDir(), FILE));
    }
}
