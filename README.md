# portfolio

## Ritual: daily habit tracker (`tracker/`)

A private habit tracker that installs to your home screen. Plain HTML, CSS and JS: no build step, no dependencies, no backend.

- **Today:** a day wheel with one arc per habit, check-off and count goals (e.g. 8 glasses of water), streaks, and a swipeable strip of past days for logging late.
- **Insights:** perfect-day streak, 30-day completion, last 7 days, an 18–26 week consistency heatmap, and a per-habit breakdown.
- **Habit detail:** current and best streak, 30-day rate, and a monthly calendar you can tap to backfill.
- Light and dark themes, works offline, and installs as an app (PWA).

### Run locally

```sh
cd tracker
python3 -m http.server 4173   # then open http://localhost:4173
```

It must be served over http(s), because ES modules and the service worker don't load from `file://`.

### Deploy

Upload the `tracker/` folder to any static host. All paths are relative, so it works at a subpath such as `yoursite.com/tracker/`.

### Your data

Everything is stored in the browser's `localStorage` on that device. There's no account and no sync. To keep it safe:

- **Install it** (Add to Home Screen). Safari can clear storage for websites you haven't visited in 7 days, but installed web apps are exempt.
- **Export a backup** from Settings now and then, and before switching phones. *Restore from backup* loads the backup back in.

### Android app (`android/`)

A small native shell that runs the same `tracker/` files in a full-screen WebView. The files are bundled into the APK, so it works offline and never touches the network. The native side handles:

- the back button (closes the open sheet, then returns to Today)
- system bar colours that follow the theme
- haptics
- saving and opening backups through Android's file picker
- **Reminders:** one time per habit, sent only on scheduled days when the habit isn't done yet. The notification has *Done* or *+1* buttons. Alarms are set again after a restart, an app update, or a clock or time-zone change.
- **Home-screen widget:** today's day wheel and habits, with tap-to-check circles. It refreshes on every change and just after midnight.

**Where the data lives.** On Android, the data is a JSON file in the app's private storage. The app, the widget and reminders all share it, and writes are atomic. The page's `localStorage` keeps a mirror; that's also where 1.0 stored data, which is copied into the file on first launch.

**Rescue copies.** If saved data can't be read in full, the app parks the original before anything can overwrite it, in the app's `rescue/` folder or under `ritual.rescue.*` in the browser. It keeps the 5 newest. Settings (or the welcome screen) offers to export the latest one.

**Install:** download the APK on your phone and tap it. Android will ask you to allow installs from that app (your browser or Files) the first time.

**Updates keep your data only if they're signed with the same key.** The key is deliberately not in this repo, because the repo is public.

**Build it yourself.** You need JDK 17+ and the Android SDK (platform 36):

```sh
cd android
RITUAL_KEYSTORE=/path/to/ritual-release.jks RITUAL_KEYSTORE_PASSWORD=… ./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Without those variables you get an unsigned APK, which is only useful as a build check.

**Automatic releases.** `.github/workflows/android.yml` builds on every push that touches `tracker/` or `android/`. To have it publish signed APKs to GitHub Releases, add two repository secrets under *Settings → Secrets and variables → Actions*:

- `RITUAL_KEYSTORE_BASE64`: the keystore file, base64-encoded
- `RITUAL_KEYSTORE_PASSWORD`: its password

After that, the newest APK is always at `https://github.com/jn-divyank/portfolio/releases/latest/download/Ritual.apk`.

### Tests

```sh
node --test                                  # streak, rate and perfect-day logic in tracker/lib.js
cd android && ./gradlew testReleaseUnitTest  # Robolectric: data file, reminders, notifications, widget
```

The widget tests inflate the layouts the way a launcher does, so a view that isn't allowed in widgets fails the build instead of showing "Can't load widget" on a phone.

### Credits

Icons are from [Lucide](https://lucide.dev) (ISC). The font is [Inter](https://rsms.me/inter/) (SIL OFL 1.1; see `tracker/assets/fonts/LICENSE-Inter.txt`).
