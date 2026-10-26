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

### Tests

```sh
node --test
```

These cover the streak, completion-rate and perfect-day logic in `tracker/lib.js`.

### Credits

Icons are from [Lucide](https://lucide.dev) (ISC). The font is [Inter](https://rsms.me/inter/) (SIL OFL 1.1; see `tracker/assets/fonts/LICENSE-Inter.txt`).
