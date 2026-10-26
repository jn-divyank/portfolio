import { icon } from './icons.js';
import * as L from './lib.js';

/* ---------- Constants ---------- */

const STORAGE_KEY = 'ritual.v1';
const VERSION = '1.1';

const COLORS = [
  { id: 'coral', name: 'Coral', hex: '#FF5D5D', deep: '#E5484D' },
  { id: 'orange', name: 'Orange', hex: '#FF8A34', deep: '#E46F16' },
  { id: 'amber', name: 'Amber', hex: '#FFC22E', deep: '#C08A00', on: '#231A00' },
  { id: 'green', name: 'Green', hex: '#34C77B', deep: '#17A15E' },
  { id: 'teal', name: 'Teal', hex: '#2EC4B6', deep: '#0E9E91' },
  { id: 'sky', name: 'Sky', hex: '#38B6FF', deep: '#0A92E0' },
  { id: 'blue', name: 'Blue', hex: '#4C7DFF', deep: '#3363F0' },
  { id: 'violet', name: 'Violet', hex: '#8B6CFF', deep: '#6F4FF2' },
  { id: 'pink', name: 'Pink', hex: '#FF5FA2', deep: '#E83E86' },
  { id: 'graphite', name: 'Graphite', hex: '#8E8E93', deep: '#636366' },
];

const HABIT_ICONS = [
  'sparkles', 'glass-water', 'droplet', 'book-open', 'notebook-pen', 'pen-line', 'dumbbell', 'footprints', 'bike',
  'person-standing', 'activity', 'heart-pulse', 'brain', 'flower-2', 'leaf', 'sprout', 'sun', 'sunrise', 'moon',
  'bed', 'alarm-clock', 'pill', 'apple', 'salad', 'carrot', 'coffee', 'cigarette-off', 'wine-off', 'ban',
  'phone-off', 'wallet', 'piggy-bank', 'languages', 'graduation-cap', 'code', 'laptop', 'music', 'guitar',
  'palette', 'camera', 'smile', 'hand-heart', 'users', 'dog', 'bath', 'mountain', 'waves', 'snowflake', 'timer',
  'list-todo', 'briefcase', 'house', 'zap', 'target', 'trophy',
];

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const STARTERS = [
  { key: 'water', name: 'Drink water', icon: 'glass-water', color: 'sky', type: 'count', target: 8, unit: 'glasses' },
  { key: 'read', name: 'Read 20 minutes', icon: 'book-open', color: 'orange', type: 'check' },
  { key: 'move', name: 'Work out', icon: 'dumbbell', color: 'coral', type: 'check' },
  { key: 'meditate', name: 'Meditate', icon: 'flower-2', color: 'violet', type: 'check' },
  { key: 'walk', name: 'Walk 8k steps', icon: 'footprints', color: 'green', type: 'check' },
  { key: 'journal', name: 'Journal', icon: 'notebook-pen', color: 'amber', type: 'check' },
  { key: 'sleep', name: 'Sleep by 11 pm', icon: 'moon', color: 'blue', type: 'check' },
  { key: 'phone', name: 'No phone in bed', icon: 'phone-off', color: 'pink', type: 'check' },
];

const TABS = [
  { id: 'today', label: 'Today', icon: 'circle-check' },
  { id: 'insights', label: 'Insights', icon: 'chart-column' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

/* ---------- Formatting ---------- */

const fmt = {
  long: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long' }),
  short: new Intl.DateTimeFormat(undefined, { weekday: 'short' }),
  narrow: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }),
  month: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }),
  monthShort: new Intl.DateTimeFormat(undefined, { month: 'short' }),
  dayMonth: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
  time: new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }),
};

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return fmt.time.format(new Date(2026, 0, 1, h, m));
}

// Index by Date#getDay() (0 = Sunday). 4 Jan 2026 is a Sunday.
const DOW_SHORT = EVERY_DAY.map((i) => fmt.short.format(new Date(2026, 0, 4 + i)));
const DOW_NARROW = EVERY_DAY.map((i) => fmt.narrow.format(new Date(2026, 0, 4 + i)));

/* ---------- State ---------- */

function defaultState() {
  return { version: 1, habits: [], logs: {}, settings: { theme: 'system', weekStart: 1, haptics: true } };
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalize(data) {
  if (!data || !Array.isArray(data.habits) || typeof data.logs !== 'object' || data.logs === null) {
    throw new Error('That file is not a Ritual backup.');
  }
  const habits = data.habits
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string' && KEY_RE.test(h.createdAt))
    .map((h) => ({
      id: h.id,
      name: h.name.slice(0, 60),
      icon: HABIT_ICONS.includes(h.icon) ? h.icon : 'sparkles',
      color: COLORS.some((c) => c.id === h.color) ? h.color : 'coral',
      type: h.type === 'count' ? 'count' : 'check',
      target: h.type === 'count' ? Math.max(1, Math.min(999, Math.round(Number(h.target)) || 1)) : 1,
      unit: h.type === 'count' && typeof h.unit === 'string' ? h.unit.slice(0, 20) : '',
      days: Array.isArray(h.days) && h.days.length ? EVERY_DAY.filter((d) => h.days.includes(d)) : [...EVERY_DAY],
      createdAt: h.createdAt,
      reminder: typeof h.reminder === 'string' && TIME_RE.test(h.reminder) ? h.reminder : null,
    }));
  const ids = new Set(habits.map((h) => h.id));
  const logs = {};
  for (const [key, entries] of Object.entries(data.logs)) {
    if (!KEY_RE.test(key) || typeof entries !== 'object' || entries === null) continue;
    for (const [id, n] of Object.entries(entries)) {
      if (ids.has(id) && Number.isFinite(n) && n > 0) (logs[key] ??= {})[id] = Math.round(n);
    }
  }
  const base = defaultState().settings;
  const s = data.settings ?? {};
  return {
    version: 1,
    habits,
    logs,
    settings: {
      theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : base.theme,
      weekStart: s.weekStart === 0 ? 0 : 1,
      haptics: s.haptics !== false,
    },
  };
}

/* ---------- Storage ---------- */

// Present when running inside the Android app (see android/).
const native = window.RitualNative ?? null;

// In the Android app, the app's data file is the source of truth, shared with the home-screen
// widget and reminders; localStorage keeps a mirror (and is where older versions stored data).
// On the web, localStorage is all there is.
const RESCUE_PREFIX = 'ritual.rescue.';
const MAX_RESCUES = 5;
let lastSaved = null;
let rescuedNow = false;

function readSaved() {
  const fromApp = native?.readState();
  if (fromApp) return fromApp;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Data that can't be read in full is parked before anything can overwrite it.
function keepRescueCopy(raw) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (native) {
    rescuedNow = native.saveRescue(raw, `ritual-unreadable-${stamp}.json`);
    return;
  }
  try {
    const old = rescueCopies().slice(MAX_RESCUES - 1);
    old.forEach((r) => localStorage.removeItem(r.name));
    localStorage.setItem(RESCUE_PREFIX + stamp, raw);
    rescuedNow = true;
  } catch {
    // Storage full or blocked; nothing more we can do here.
  }
}

// Newest first.
function rescueCopies() {
  if (native) return JSON.parse(native.listRescues() || '[]').map((name) => ({ name }));
  const names = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(RESCUE_PREFIX)) names.push(key);
    }
  } catch {
    return [];
  }
  return names.sort().reverse().map((name) => ({ name }));
}

function readRescue(name) {
  return native ? native.readRescue(name) : localStorage.getItem(name);
}

function load() {
  const raw = readSaved();
  if (!raw) return defaultState();
  lastSaved = raw;
  try {
    const data = JSON.parse(raw);
    const loaded = normalize(data);
    if (loaded.habits.length < data.habits.length) keepRescueCopy(raw);
    return loaded;
  } catch {
    keepRescueCopy(raw);
    return defaultState();
  }
}

let state = load();

function save() {
  const json = JSON.stringify(state);
  lastSaved = json;
  let ok = native ? native.writeState(json) : true;
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    if (!native) ok = false;
  }
  if (!ok) toast('Couldn’t save. Storage may be full or blocked.');
}

// First run of the Android app after updating: move data into the shared app file.
if (native && !native.readState()) save();

// The widget or a notification changed the data while the app was open in the background.
function reloadFromApp() {
  if (!native) return;
  const raw = native.readState();
  if (!raw || raw === lastSaved) return;
  try {
    state = normalize(JSON.parse(raw));
  } catch {
    return;
  }
  lastSaved = raw;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Mirror only; the app file already has it.
  }
  applyTheme();
  render();
  refreshSheets();
}

const ui = {
  tab: 'today',
  date: L.startOfDay(),
  picked: new Set(),
  justAdded: new Set(),
};

let todayKey = L.dateKey(L.startOfDay());
let installEvent = null;

/* ---------- Helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const colorOf = (id) => COLORS.find((c) => c.id === id) ?? COLORS[0];

function colorVars(id) {
  const c = colorOf(id);
  return `--c:${c.hex};--cd:${c.deep};--on:${c.on ?? '#fff'}`;
}

function setColorVars(el, id) {
  const c = colorOf(id);
  el.style.setProperty('--c', c.hex);
  el.style.setProperty('--cd', c.deep);
  el.style.setProperty('--on', c.on ?? '#fff');
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const habitById = (id) => state.habits.find((h) => h.id === id);
const selKey = () => L.dateKey(ui.date);
const isTodaySelected = () => selKey() === todayKey;
const pct = (r) => (r === null ? '–' : Math.round(r * 100));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isWide = () => matchMedia('(min-width: 720px)').matches;

const VIBRATION = { tick: 6, success: 14, undo: [6, 30, 6], celebrate: [10, 50, 20] };

function haptic(kind = 'tick') {
  if (!state.settings.haptics) return;
  if (native) native.haptic(kind);
  else navigator.vibrate?.(VIBRATION[kind]);
}

function orderedDays() {
  return state.settings.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [...EVERY_DAY];
}

function scheduleLabel(days) {
  if (days.length === 7) return 'Every day';
  const s = [...days].sort().join('');
  if (s === '12345') return 'Weekdays';
  if (s === '06') return 'Weekends';
  return orderedDays()
    .filter((d) => days.includes(d))
    .map((d) => DOW_SHORT[d])
    .join(', ');
}

function dayTitle(d) {
  const key = L.dateKey(d);
  if (key === todayKey) return 'Today';
  if (key === L.dateKey(L.addDays(L.startOfDay(), -1))) return 'Yesterday';
  return fmt.weekday.format(d);
}

function goalLabel(h) {
  return h.type === 'count' ? `${h.target}${h.unit ? ` ${esc(h.unit)}` : ''}` : scheduleLabel(h.days);
}

function setCount(id, key, n) {
  if (n > 0) {
    (state.logs[key] ??= {})[id] = n;
  } else if (state.logs[key]) {
    delete state.logs[key][id];
    if (!Object.keys(state.logs[key]).length) delete state.logs[key];
  }
}

function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}

/* ---------- Theme ---------- */

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && darkQuery.matches);
  document.documentElement.classList.toggle('is-dark', dark);
  $('meta[name="theme-color"]').content = dark ? '#0A0A0B' : '#F5F4F0';
  native?.setTheme(dark);
}

darkQuery.addEventListener('change', applyTheme);

/* ---------- Shared SVG ---------- */

function ringSVG(cls, size, r, p) {
  const c = size / 2;
  const C = 2 * Math.PI * r;
  return `<svg class="${cls}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle class="track" cx="${c}" cy="${c}" r="${r}"/>
    <circle class="fill" cx="${c}" cy="${c}" r="${r}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - p)).toFixed(2)}" style="opacity:${p > 0 ? 1 : 0}"/>
  </svg>`;
}

// One arc per habit, filled by its progress. The signature element of the app.
function wheelSVG(items, { r = 48, sw = 11 } = {}) {
  const C = 2 * Math.PI * r;
  const n = Math.max(items.length, 1);
  const seg = C / n;
  const gap = items.length > 1 ? Math.min(sw + 6, seg * 0.45) : 0;
  const len = seg - gap;
  const size = (r + sw) * 2;
  const c = size / 2;
  const arcs = items.length
    ? items.map((it, i) => {
        const rot = ((i * seg + gap / 2) / C) * 360;
        return `<g transform="rotate(${rot.toFixed(3)} ${c} ${c})" style="${colorVars(it.color)}">
          <circle class="seg-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}"/>
          <circle class="seg-fill" cx="${c}" cy="${c}" r="${r}" stroke-width="${sw}" data-len="${len.toFixed(2)}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(len * (1 - it.p)).toFixed(2)}" style="opacity:${it.p > 0 ? 1 : 0}"/>
        </g>`;
      })
    : [`<circle class="seg-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${sw}"/>`];
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${arcs.join('')}</svg>`;
}

/* ---------- Navigation ---------- */

function renderNav() {
  $('.nav-items').innerHTML =
    `<span class="tab-indicator" aria-hidden="true"></span>` +
    TABS.map(
      (t) =>
        `<button class="tab" type="button" role="tab" data-action="tab" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></button>`,
    ).join('');
  $('.nav-new').innerHTML = `${icon('plus')}<span>New habit</span>`;
}

function updateNav() {
  const index = TABS.findIndex((t) => t.id === ui.tab);
  $$('.tab').forEach((el) => el.setAttribute('aria-selected', String(el.dataset.tab === ui.tab)));
  $('.tab-indicator').style.setProperty('--i', index);
}

/* ---------- Render ---------- */

function render({ enter = false } = {}) {
  const weekScroll = $('#week')?.scrollLeft;
  if (ui.tab === 'today') view.innerHTML = todayHTML();
  else if (ui.tab === 'insights') view.innerHTML = insightsHTML();
  else view.innerHTML = settingsHTML();
  if (enter) view.firstElementChild?.nextElementSibling?.classList.add('page-enter');
  updateNav();
  document.documentElement.classList.toggle('onboarding', ui.tab === 'today' && !state.habits.length);
  if (ui.tab === 'today') mountToday(weekScroll);
  if (ui.tab === 'insights') mountInsights();
  ui.justAdded.clear();
  onScroll();
}

function topbar(title) {
  return `<div class="topbar" aria-hidden="true">${esc(title)}</div>`;
}

/* ---------- Today ---------- */

function todayHTML() {
  const d = ui.date;
  const title = state.habits.length ? dayTitle(d) : 'Welcome';
  return `${topbar(title)}
  <section class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">${fmt.long.format(d)}</p>
        <h1 class="large-title">${title}</h1>
      </div>
      ${
        state.habits.length
          ? `<div class="head-actions">
              ${isTodaySelected() ? '' : `<button class="chip-btn" type="button" data-action="go-today">Today</button>`}
              <button class="round-btn" type="button" data-action="new-habit" aria-label="New habit">${icon('plus')}</button>
            </div>`
          : ''
      }
    </header>
    ${state.habits.length ? `<div class="week" id="week">${weekHTML()}</div><div id="day">${dayHTML()}</div>` : emptyHTML()}
  </section>`;
}

// Rolling pages of 7 days; the last page always ends today, so recent days are one tap away.
function weekHTML() {
  const today = L.startOfDay();
  const span = Math.round((today - L.parseKey(L.earliestStart(state))) / 86_400_000) + 1;
  const count = Math.min(52, Math.max(4, Math.ceil(span / 7)));
  const pages = [];
  for (let k = count - 1; k >= 0; k--) {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(dayButtonHTML(L.addDays(today, -7 * k - i)));
    pages.push(`<div class="week-page">${days.join('')}</div>`);
  }
  return pages.join('');
}

function dayButtonHTML(d) {
  const key = L.dateKey(d);
  const p = L.dayProgress(state, d);
  const cls = ['day', key === todayKey && 'is-today', p === null && 'is-empty'].filter(Boolean).join(' ');
  return `<button class="${cls}" type="button" data-action="select-day" data-date="${key}" aria-pressed="${key === selKey()}"
      aria-label="${fmt.long.format(d)}" ${key > todayKey ? 'disabled' : ''}>
    <span class="day-name">${DOW_NARROW[d.getDay()]}</span>
    <span class="day-num">${ringSVG('day-ring', 36, 15, p ?? 0)}<span>${d.getDate()}</span></span>
  </button>`;
}

function dayHTML() {
  const habits = L.habitsOn(state, ui.date);
  if (!habits.length) {
    return `<div class="rest">
      <div class="rest-icon">${icon('sunrise')}</div>
      <h2>Nothing scheduled</h2>
      <p>${isTodaySelected() ? 'A rest day. Enjoy it.' : 'No habits were scheduled on this day.'}</p>
    </div>`;
  }
  const key = selKey();
  return `<section class="hero" id="hero">
      <div class="wheel">${wheelSVG(habits.map((h) => ({ color: h.color, p: L.progress(state, h, key) })))}
        <div class="wheel-label"><span class="wheel-count" id="wheel-count"></span><span class="wheel-total">of ${habits.length}</span></div>
      </div>
      <div class="hero-copy">
        <h2 class="hero-title" id="hero-title"></h2>
        <p class="hero-sub" id="hero-sub"></p>
        <span class="chip-streak" id="hero-streak" hidden>${icon('flame')}<span></span></span>
      </div>
    </section>
    <div class="section-head">
      <h2 class="section-title">Habits</h2>
      <span class="section-meta">${habits.some((h) => h.type === 'count') ? 'Hold a counter to undo' : ''}</span>
    </div>
    <div class="habits">${habits.map(habitCardHTML).join('')}</div>`;
}

function habitCardHTML(h) {
  const C = (2 * Math.PI * 22.5).toFixed(2);
  return `<article class="habit${ui.justAdded.has(h.id) ? ' is-new' : ''}" data-id="${h.id}" style="${colorVars(h.color)}">
    <div class="habit-fill"></div>
    <button class="habit-main" type="button" data-action="open-habit" data-id="${h.id}">
      <span class="habit-icon">${icon(h.icon)}</span>
      <span class="habit-text">
        <span class="habit-name">${esc(h.name)}</span>
        <span class="habit-meta"></span>
      </span>
    </button>
    <button class="check" type="button" data-action="check" data-id="${h.id}">
      <svg class="check-ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle class="track" cx="24" cy="24" r="22.5"/>
        <circle class="fill" cx="24" cy="24" r="22.5" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
      </svg>
      <span class="check-bg"></span>
      ${h.type === 'count' ? icon('plus', 'check-plus') : ''}
      ${icon('check', 'check-mark')}
    </button>
  </article>`;
}

function updateCard(h) {
  const el = $(`.habit[data-id="${h.id}"]`, view);
  if (!el) return;
  const key = selKey();
  const count = L.countFor(state, h.id, key);
  const p = L.progress(state, h, key);
  const done = L.isDone(state, h, key);
  const streak = L.currentStreak(state, h, L.startOfDay());

  el.classList.toggle('is-done', done);
  el.style.setProperty('--fill', h.type === 'count' ? p : done ? 1 : 0);

  const fill = $('.check-ring .fill', el);
  const C = Number(fill.getAttribute('stroke-dasharray'));
  fill.setAttribute('stroke-dashoffset', (C * (1 - (h.type === 'count' ? p : 0))).toFixed(2));
  fill.style.opacity = h.type === 'count' && p > 0 ? 1 : 0;

  const btn = $('.check', el);
  if (h.type === 'check') {
    btn.setAttribute('aria-pressed', String(done));
    btn.setAttribute('aria-label', `${h.name}: ${done ? 'done' : 'not done'}`);
  } else {
    btn.setAttribute('aria-label', `Add one to ${h.name}, ${count} of ${h.target}${h.unit ? ` ${h.unit}` : ''}`);
  }

  const parts = [];
  if (h.type === 'count') {
    parts.push(`<span><span class="num">${count} / ${h.target}</span>${h.unit ? ` ${esc(h.unit)}` : ''}</span>`);
  }
  if (streak > 0) {
    parts.push(`<span class="flame">${icon('flame')}${h.type === 'count' ? streak : `${streak}-day streak`}</span>`);
  } else if (h.type === 'check') {
    parts.push(`<span>${scheduleLabel(h.days)}</span>`);
  }
  $('.habit-meta', el).innerHTML = parts.join('<span class="sep" aria-hidden="true">·</span>');
}

function heroCopy(done, total) {
  const past = !isTodaySelected();
  const left = total - done;
  if (done === total) {
    return ['Perfect day', past ? 'Every habit kept. Nicely done.' : 'Every habit kept. See you tomorrow.'];
  }
  if (done === 0) {
    return past ? ['Nothing logged', 'Tap a habit to log it for this day.'] : ['Fresh start', 'Begin with the easiest one. Momentum does the rest.'];
  }
  return [`${done} of ${total} done`, left === 1 ? 'One more for a perfect day.' : `${left} more for a perfect day.`];
}

function updateHero() {
  const hero = $('#hero');
  if (!hero) return;
  const key = selKey();
  const habits = L.habitsOn(state, ui.date);
  $$('.seg-fill', hero).forEach((arc, i) => {
    const h = habits[i];
    if (!h) return;
    const p = L.progress(state, h, key);
    arc.setAttribute('stroke-dashoffset', (Number(arc.dataset.len) * (1 - p)).toFixed(2));
    arc.style.opacity = p > 0 ? 1 : 0;
  });
  const done = habits.filter((h) => L.isDone(state, h, key)).length;
  const [title, sub] = heroCopy(done, habits.length);
  $('#wheel-count').textContent = done;
  $('#hero-title').textContent = title;
  $('#hero-sub').textContent = sub;
  hero.classList.toggle('is-perfect', done === habits.length);

  const { current } = L.perfectStreaks(state, L.startOfDay());
  const chip = $('#hero-streak');
  chip.hidden = !(isTodaySelected() && current > 0);
  chip.lastElementChild.textContent = `${current}-day streak`;
  chip.title = 'Perfect days in a row';
}

function updateDayButton(key) {
  const btn = $(`.day[data-date="${key}"]`, view);
  if (!btn) return;
  const p = L.dayProgress(state, L.parseKey(key));
  btn.classList.toggle('is-empty', p === null);
  const fill = $('.day-ring .fill', btn);
  const C = Number(fill.getAttribute('stroke-dasharray'));
  fill.setAttribute('stroke-dashoffset', (C * (1 - (p ?? 0))).toFixed(2));
  fill.style.opacity = p ? 1 : 0;
}

function refreshDay() {
  L.habitsOn(state, ui.date).forEach(updateCard);
  updateHero();
  updateDayButton(selKey());
}

function mountToday(weekScroll) {
  const week = $('#week');
  if (week) {
    if (weekScroll != null) week.scrollLeft = weekScroll;
    else scrollWeekTo(selKey(), false);
  }
  refreshDay();
}

function scrollWeekTo(key, smooth) {
  const week = $('#week');
  const page = $(`.day[data-date="${key}"]`, week)?.closest('.week-page');
  if (page) week.scrollTo({ left: page.offsetLeft, behavior: smooth && !reducedMotion() ? 'smooth' : 'instant' });
}

function selectDate(key) {
  if (key > todayKey) return;
  ui.date = L.parseKey(key);
  render();
}

function onCheck(btn) {
  const h = habitById(btn.dataset.id);
  if (!h) return;
  const key = selKey();
  const count = L.countFor(state, h.id, key);
  const wasDone = count >= h.target;
  const wasPerfect = L.isPerfect(state, ui.date);
  setCount(h.id, key, h.type === 'check' ? (wasDone ? 0 : h.target) : count + 1);
  save();

  const nowDone = L.isDone(state, h, key);
  restartAnimation(btn, 'pop');
  if (nowDone && !wasDone) {
    restartAnimation(btn, 'burst');
    haptic('success');
  } else {
    haptic('tick');
  }
  refreshDay();

  if (wasPerfect !== true && L.isPerfect(state, ui.date) === true) celebrate();
}

function decrement(btn) {
  const h = habitById(btn.dataset.id);
  if (!h) return;
  const key = selKey();
  const count = L.countFor(state, h.id, key);
  if (!count) return;
  setCount(h.id, key, h.type === 'check' ? 0 : count - 1);
  save();
  haptic('undo');
  restartAnimation(btn, 'pop');
  refreshDay();
}

function restartAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

function celebrate() {
  haptic('celebrate');
  const wheel = $('#hero .wheel');
  if (!wheel || reducedMotion()) return;
  const r = wheel.getBoundingClientRect();
  const colors = L.habitsOn(state, ui.date).map((h) => colorOf(h.color).hex);
  confetti(r.left + r.width / 2, r.top + r.height / 2, colors);
}

/* ---------- Empty state / onboarding ---------- */

function emptyHTML() {
  const art = [
    { color: 'coral', p: 1 },
    { color: 'amber', p: 1 },
    { color: 'green', p: 1 },
    { color: 'blue', p: 0.45 },
  ];
  return `<div class="empty">
    <div class="empty-art" aria-hidden="true">
      <span class="float-tile" style="${colorVars('sky')}">${icon('glass-water')}</span>
      <span class="float-tile" style="${colorVars('orange')}">${icon('book-open')}</span>
      <span class="float-tile" style="${colorVars('violet')}">${icon('flower-2')}</span>
      <div class="wheel">${wheelSVG(art, { r: 46, sw: 12 })}</div>
    </div>
    <h2>Small rituals,<br>big results.</h2>
    <p>Pick a few habits to start with. You can change them anytime.</p>
    ${
      rescueCopies().length
        ? `<button class="rescue-note" type="button" data-action="export-rescue">
            ${icon('life-buoy')}
            <span><strong>Your earlier data couldn’t be read.</strong> A copy was kept. Tap to export it so it can be repaired.</span>
          </button>`
        : ''
    }
    <div class="starters">
      ${STARTERS.map(
        (s) => `<button class="starter" type="button" data-action="pick" data-key="${s.key}" aria-pressed="${ui.picked.has(s.key)}" style="${colorVars(s.color)}">
          <span class="habit-icon">${icon(s.icon)}</span>
          <span class="starter-text">
            <span class="starter-name">${esc(s.name)}</span>
            <span class="starter-meta">${s.type === 'count' ? `${s.target} ${s.unit} a day` : 'Every day'}</span>
          </span>
          <span class="starter-tick">${icon('check')}</span>
        </button>`,
      ).join('')}
    </div>
    <div class="empty-actions">
      <button class="btn btn-primary btn-block" type="button" data-action="add-picked" ${ui.picked.size ? '' : 'disabled'}>
        ${ui.picked.size ? `Start with ${ui.picked.size} habit${ui.picked.size > 1 ? 's' : ''}` : 'Choose habits to start'}
      </button>
      <button class="btn btn-quiet btn-block" type="button" data-action="new-habit">Create your own</button>
      <label class="restore-link">Have a backup? <span>Restore it</span>
        <input type="file" accept="application/json,.json" class="sr-only" data-action="import">
      </label>
    </div>
  </div>`;
}

function togglePick(btn) {
  const k = btn.dataset.key;
  if (ui.picked.has(k)) ui.picked.delete(k);
  else ui.picked.add(k);
  btn.setAttribute('aria-pressed', String(ui.picked.has(k)));
  haptic('tick');
  const cta = $('[data-action="add-picked"]', view);
  const n = ui.picked.size;
  cta.disabled = !n;
  cta.textContent = n ? `Start with ${n} habit${n > 1 ? 's' : ''}` : 'Choose habits to start';
}

function addPicked() {
  for (const s of STARTERS) {
    if (!ui.picked.has(s.key)) continue;
    const id = uid();
    state.habits.push({
      id,
      name: s.name,
      icon: s.icon,
      color: s.color,
      type: s.type,
      target: s.target ?? 1,
      unit: s.unit ?? '',
      days: [...EVERY_DAY],
      createdAt: todayKey,
    });
    ui.justAdded.add(id);
  }
  ui.picked.clear();
  ui.date = L.startOfDay();
  save();
  requestPersistence();
  render({ enter: true });
}

/* ---------- Insights ---------- */

function insightsHTML() {
  const head = `${topbar('Insights')}
  <section class="page">
    <header class="page-head"><div><p class="eyebrow">Your progress</p><h1 class="large-title">Insights</h1></div></header>`;
  if (!state.habits.length) {
    return `${head}<div class="rest">
      <div class="rest-icon">${icon('chart-column')}</div>
      <h2>No data yet</h2>
      <p>Add a habit and check in for a few days. Your trends will show up here.</p>
      <button class="btn btn-primary" type="button" data-action="tab" data-tab="today" style="margin-top:20px">Get started</button>
    </div></section>`;
  }

  const now = L.startOfDay();
  const { current, best } = L.perfectStreaks(state, now);
  const rate = L.overallRate(state, now, 30);
  const week = L.checkIns(state, L.startOfWeek(now, state.settings.weekStart), now);

  const last7 = Array.from({ length: 7 }, (_, i) => L.addDays(now, i - 6));
  const dots = last7
    .map((d) => {
      const p = L.isPerfect(state, d);
      const prog = L.dayProgress(state, d);
      const cls = p === null ? 'none' : p ? 'on' : prog > 0 ? 'part' : '';
      return `<div><i class="${cls}"></i><span>${DOW_NARROW[d.getDay()]}</span></div>`;
    })
    .join('');

  const values = last7.map((d) => L.dayProgress(state, d));
  const scheduled = values.filter((v) => v !== null);
  const avg = scheduled.length ? scheduled.reduce((a, b) => a + b, 0) / scheduled.length : null;
  const bars = last7
    .map(
      (d, i) => `<div class="bar${i === 6 ? ' is-today' : ''}">
        <div class="bar-track"><div class="bar-fill" data-p="${values[i] ?? 0}"></div></div>
        <span class="bar-label">${DOW_NARROW[d.getDay()]}</span>
      </div>`,
    )
    .join('');

  const habitRows = state.habits
    .map((h) => ({ h, rate: L.completionRate(state, h, now, 30), streak: L.currentStreak(state, h, now) }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))
    .map(
      ({ h, rate: r, streak }) => `<button class="row habit-row" type="button" data-action="open-habit" data-id="${h.id}" style="${colorVars(h.color)}">
        <span class="habit-icon">${icon(h.icon)}</span>
        <span class="row-text">
          <span class="row-title">${esc(h.name)}</span>
          <span class="meter"><span data-p="${r ?? 0}"></span></span>
        </span>
        <span class="row-end">
          ${streak ? `<span class="flame">${icon('flame')}${streak}</span>` : ''}
          <span>${pct(r)}${r === null ? '' : '%'}</span>
        </span>
      </button>`,
    )
    .join('');

  return `${head}
    <div class="tiles">
      <div class="tile feature">
        <div class="tile-label">${icon('flame')}Perfect-day streak</div>
        <div class="feature-row">
          <div>
            <div class="tile-value">${current}<small>${current === 1 ? 'day' : 'days'}</small></div>
            <div class="tile-sub">Best: ${best} ${best === 1 ? 'day' : 'days'}</div>
          </div>
          <div class="dots" aria-label="Last 7 days">${dots}</div>
        </div>
      </div>
      <div class="tile">
        <div class="tile-label">${icon('target')}Completion</div>
        <div class="tile-value">${pct(rate)}<small>${rate === null ? '' : '%'}</small></div>
        <div class="tile-sub">Last 30 days</div>
      </div>
      <div class="tile">
        <div class="tile-label">${icon('circle-check')}This week</div>
        <div class="tile-value">${week.done}<small>/${week.scheduled}</small></div>
        <div class="tile-sub">Check-ins</div>
      </div>
    </div>

    <section class="card">
      <div class="card-head"><h2 class="card-title">Last 7 days</h2><span class="card-meta">${avg === null ? '' : `Avg ${pct(avg)}%`}</span></div>
      <div class="bars">${bars}</div>
    </section>

    <section class="card">
      <div class="card-head"><h2 class="card-title">Consistency</h2><span class="card-meta" id="heat-range"></span></div>
      <div class="heat-wrap" id="heat"></div>
      <div class="legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="heat-cell" data-l="${l}"></i>`).join('')}<span>More</span></div>
    </section>

    <div class="section-head"><h2 class="section-title">By habit</h2><span class="section-meta">30-day rate</span></div>
    <div class="list">${habitRows}</div>
  </section>`;
}

function heatHTML(weeks) {
  const now = L.startOfDay();
  const ws = state.settings.weekStart;
  const first = L.addDays(L.startOfWeek(now, ws), -7 * (weeks - 1));
  const cells = [];
  const starts = [];
  for (let w = 0; w < weeks; w++) {
    const start = L.addDays(first, w * 7);
    if (w === 0 || start.getMonth() !== L.addDays(start, -7).getMonth()) starts.push({ w, start });
  }
  // Drop the leading partial month if the next label would crowd it.
  if (starts.length > 1 && starts[1].w < 3) starts.shift();
  const months = starts.map(({ w, start }) => `<span style="grid-column:${w + 1}">${fmt.monthShort.format(start)}</span>`);
  for (let w = 0; w < weeks; w++) {
    const start = L.addDays(first, w * 7);
    for (let i = 0; i < 7; i++) {
      const d = L.addDays(start, i);
      const key = L.dateKey(d);
      if (key > todayKey) {
        cells.push(`<i class="future"></i>`);
        continue;
      }
      const p = L.dayProgress(state, d);
      const label = p === null ? 'nothing scheduled' : `${pct(p)}%`;
      cells.push(`<i data-l="${L.heatLevel(p)}" title="${fmt.dayMonth.format(d)}: ${label}"></i>`);
    }
  }
  return `<div class="heat-months" style="--weeks:${weeks}">${months.join('')}</div>
    <div class="heat" style="--weeks:${weeks}" role="img" aria-label="Daily completion over the last ${weeks} weeks">${cells.join('')}</div>`;
}

function mountInsights() {
  const heat = $('#heat');
  if (heat) {
    const weeks = heat.clientWidth >= 520 ? 26 : 18;
    heat.innerHTML = heatHTML(weeks);
    $('#heat-range').textContent = `${weeks} weeks`;
  }
  // Grow bars and meters in from zero.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      $$('[data-p]', view).forEach((el) => el.style.setProperty('--p', el.dataset.p));
    }),
  );
}

/* ---------- Settings ---------- */

function segmentedHTML(action, options, value) {
  return `<div class="segmented" role="radiogroup">${options
    .map(
      ([v, label]) =>
        `<button type="button" role="radio" data-action="${action}" data-value="${v}" aria-checked="${String(v) === String(value)}">${label}</button>`,
    )
    .join('')}</div>`;
}

function settingsHTML() {
  const s = state.settings;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const total = state.habits.length;
  const checkins = Object.values(state.logs).reduce((n, day) => n + Object.keys(day).length, 0);

  let install = '';
  if (!standalone && (installEvent || ios)) {
    install = `<div class="group">
      <h2 class="group-title">App</h2>
      <div class="list">
        ${
          installEvent
            ? `<button class="row" type="button" data-action="install">
                <span class="row-icon">${icon('download')}</span>
                <span class="row-text"><span class="row-title">Install Ritual</span><span class="row-sub">Full-screen app on your home screen</span></span>
              </button>`
            : `<div class="row">
                <span class="row-icon">${icon('download')}</span>
                <span class="row-text"><span class="row-title">Add to Home Screen</span><span class="row-sub">In Safari, tap Share, then “Add to Home Screen”</span></span>
              </div>`
        }
      </div>
      <p class="group-note">Installed, Ritual opens full-screen and the browser is far less likely to clear your data.</p>
    </div>`;
  }

  return `${topbar('Settings')}
  <section class="page">
    <header class="page-head"><div><p class="eyebrow">Ritual ${VERSION}</p><h1 class="large-title">Settings</h1></div></header>

    <div class="privacy">
      <span class="row-icon">${icon('shield-check')}</span>
      <div>
        <h2>Private by design</h2>
        <p>Everything stays on this device. No account, no tracking, no subscription.</p>
      </div>
    </div>

    <div class="group">
      <h2 class="group-title">Appearance</h2>
      <div class="list">
        <div class="row">
          <span class="row-text"><span class="row-title">Theme</span></span>
          ${segmentedHTML('theme', [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}
        </div>
      </div>
    </div>

    <div class="group">
      <h2 class="group-title">Preferences</h2>
      <div class="list">
        <div class="row">
          <span class="row-text"><span class="row-title">Week starts on</span></span>
          ${segmentedHTML('week-start', [[1, 'Monday'], [0, 'Sunday']], s.weekStart)}
        </div>
        <div class="row">
          <span class="row-text">
            <span class="row-title">Haptic feedback</span>
            <span class="row-sub">${native ? 'Subtle vibration when you check in' : 'Vibrate on check-in, where supported'}</span>
          </span>
          <button class="switch" type="button" role="switch" data-action="haptics" aria-checked="${s.haptics}" aria-label="Haptic feedback"></button>
        </div>
      </div>
    </div>

    ${install}

    ${native ? remindersGroupHTML() : ''}

    <div class="group">
      <h2 class="group-title">Your data</h2>
      <div class="list">
        ${rescueRowHTML()}
        <button class="row" type="button" data-action="export">
          <span class="row-icon">${icon('download')}</span>
          <span class="row-text"><span class="row-title">Export backup</span><span class="row-sub">${total} habit${total === 1 ? '' : 's'} · ${checkins} check-in${checkins === 1 ? '' : 's'}</span></span>
          <span class="row-end">${icon('chevron-right', 'chev')}</span>
        </button>
        <label class="row" style="cursor:pointer">
          <span class="row-icon">${icon('upload')}</span>
          <span class="row-text"><span class="row-title">Restore from backup</span><span class="row-sub">Replaces what’s on this device</span></span>
          <span class="row-end">${icon('chevron-right', 'chev')}</span>
          <input type="file" accept="application/json,.json" class="sr-only" data-action="import">
        </label>
        <button class="row danger" type="button" data-action="erase">
          <span class="row-icon">${icon('trash-2')}</span>
          <span class="row-text"><span class="row-title">Erase all data</span></span>
        </button>
      </div>
      <p class="group-note">${
        native
          ? 'Your data lives on this phone only, and uninstalling Ritual deletes it. Export a backup now and then, especially before switching phones.'
          : 'Your data lives in this browser only. Export a backup now and then, especially before switching phones or clearing browser data.'
      }</p>
    </div>

    <p class="foot">Ritual ${VERSION} · Made for one, built with care.</p>
  </section>`;
}

function remindersGroupHTML() {
  const enabled = native.notificationsEnabled();
  const n = state.habits.filter((h) => h.reminder).length;
  const sub = !enabled
    ? 'Off · Tap to turn on'
    : n
      ? `On · ${n} habit${n === 1 ? ' has a reminder' : 's have reminders'}`
      : 'On · Set one when editing a habit';
  return `<div class="group">
      <h2 class="group-title">Reminders</h2>
      <div class="list">
        <button class="row" type="button" data-action="notifications">
          <span class="row-icon">${icon('bell')}</span>
          <span class="row-text"><span class="row-title">Notifications</span><span class="row-sub">${sub}</span></span>
          <span class="row-end">${icon('chevron-right', 'chev')}</span>
        </button>
      </div>
    </div>`;
}

function rescueRowHTML() {
  const copies = rescueCopies();
  if (!copies.length) return '';
  return `<button class="row warn" type="button" data-action="export-rescue">
      <span class="row-icon">${icon('life-buoy')}</span>
      <span class="row-text">
        <span class="row-title">Unreadable data was kept</span>
        <span class="row-sub">Export the latest copy so it can be repaired</span>
      </span>
      <span class="row-end">${icon('chevron-right', 'chev')}</span>
    </button>`;
}

function exportData() {
  exportFile(JSON.stringify(state, null, 2), `ritual-backup-${todayKey}.json`);
}

function exportRescue() {
  const [latest] = rescueCopies();
  if (!latest) return;
  const raw = readRescue(latest.name);
  exportFile(raw, native ? latest.name : `ritual-unreadable-${latest.name.slice(RESCUE_PREFIX.length)}.json`);
}

async function exportFile(json, name) {
  if (native) {
    // Opens Android's "Save to…" picker; the result comes back via ritualBackupSaved.
    native.saveBackup(json, name);
    return;
  }
  const blob = new Blob([json], { type: 'application/json' });
  // Phones (iOS home-screen apps especially) handle the share sheet far better than downloads.
  const file = new File([blob], name, { type: 'application/json' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Ritual backup' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}

async function importData(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  let next;
  try {
    next = normalize(JSON.parse(await file.text()));
  } catch (err) {
    toast(err instanceof SyntaxError ? 'That file isn’t valid JSON.' : err.message);
    return;
  }
  const n = next.habits.length;
  const ok = await confirmSheet({
    title: 'Restore this backup?',
    body: `It has ${n} habit${n === 1 ? '' : 's'}. Everything currently on this device will be replaced.`,
    confirm: 'Replace my data',
    danger: true,
  });
  if (!ok) return;
  state = next;
  save();
  applyTheme();
  ui.date = L.startOfDay();
  render();
  toast('Backup restored');
}

async function eraseAll() {
  const ok = await confirmSheet({
    title: 'Erase everything?',
    body: 'All habits and history on this device will be permanently deleted. Export a backup first if you might want it back.',
    confirm: 'Erase all data',
    danger: true,
  });
  if (!ok) return;
  state = { ...defaultState(), settings: state.settings };
  save();
  ui.date = L.startOfDay();
  ui.tab = 'today';
  render({ enter: true });
  toast('All data erased');
}

/* ---------- Sheets ---------- */

function openSheet(inner, { onMount, onClose } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet-host';
  dlg.innerHTML = `<div class="scrim" data-close></div>
    <div class="sheet" tabindex="-1" autofocus><div class="sheet-grab" aria-hidden="true"></div>${inner}</div>`;
  document.body.append(dlg);
  document.documentElement.classList.add('has-sheet');
  dlg.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('is-open')));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    const sheet = $('.sheet', dlg);
    sheet.style.transform = '';
    $('.scrim', dlg).style.opacity = '';
    dlg.classList.remove('is-open');
    setTimeout(
      () => {
        dlg.close();
        dlg.remove();
        if (!$('dialog.sheet-host')) document.documentElement.classList.remove('has-sheet');
        onClose?.();
      },
      reducedMotion() ? 0 : 420,
    );
  };
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
  });
  enableDrag(dlg, close);
  onMount?.(dlg, close);
  return close;
}

// Pull the sheet down by its grabber or header to dismiss, like a native sheet.
function enableDrag(dlg, close) {
  const sheet = $('.sheet', dlg);
  const scrim = $('.scrim', dlg);
  let startY = 0;
  let dy = 0;
  let t0 = 0;
  let dragging = false;

  const down = (e) => {
    if (isWide() || e.button > 0 || e.target.closest('button, input, label')) return;
    dragging = true;
    startY = e.clientY;
    dy = 0;
    t0 = performance.now();
    sheet.style.transition = 'none';
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    const raw = e.clientY - startY;
    dy = raw > 0 ? raw : raw / 6;
    sheet.style.transform = `translateY(${dy}px)`;
    scrim.style.opacity = String(Math.max(0, 1 - dy / sheet.offsetHeight));
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    const velocity = dy / (performance.now() - t0);
    if (dy > 110 || (dy > 20 && velocity > 0.6)) {
      close();
    } else {
      sheet.style.transform = '';
      scrim.style.opacity = '';
    }
  };
  $$('.sheet-grab, .sheet-head', sheet).forEach((el) => {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

// Lets a sheet underneath (habit detail) repaint after the editor on top saves.
function refreshSheets() {
  $$('dialog.sheet-host').forEach((dlg) => dlg.dispatchEvent(new Event('refresh')));
}

function closeAllSheets() {
  $$('dialog.sheet-host').forEach((dlg) => dlg.dispatchEvent(new Event('cancel', { cancelable: true })));
}

function confirmSheet({ title, body, confirm, danger }) {
  return new Promise((resolve) => {
    let result = false;
    openSheet(
      `<div class="confirm-body">
        <h3>${esc(title)}</h3>
        <p>${esc(body)}</p>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-block" type="button" data-ok>${esc(confirm)}</button>
        <button class="btn btn-quiet btn-block" type="button" data-close>Cancel</button>
      </div>`,
      {
        onMount(dlg, close) {
          $('[data-ok]', dlg).addEventListener('click', () => {
            result = true;
            close();
          });
        },
        onClose: () => resolve(result),
      },
    );
  });
}

/* ---------- Habit editor ---------- */

function openEditor(id) {
  const existing = id ? habitById(id) : null;
  const usedColors = new Set(state.habits.map((h) => h.color));
  const draft = existing
    ? { ...existing, days: [...existing.days], target: existing.type === 'count' ? existing.target : 8, reminderTime: existing.reminder ?? '20:00' }
    : {
        name: '',
        icon: 'sparkles',
        color: (COLORS.find((c) => !usedColors.has(c.id)) ?? COLORS[0]).id,
        type: 'check',
        target: 8,
        unit: '',
        days: [...EVERY_DAY],
        reminder: null,
        reminderTime: '20:00',
      };

  const inner = `
    <div class="sheet-head">
      <button class="text-btn" type="button" data-close>Cancel</button>
      <h3>${existing ? 'Edit habit' : 'New habit'}</h3>
      <button class="pill-btn" type="button" data-ed="save">${existing ? 'Save' : 'Add'}</button>
    </div>
    <div class="sheet-body">
      <div class="editor-hero">
        <span class="habit-icon xl" data-ed="preview"></span>
        <input class="name-input" data-ed="name" type="text" maxlength="40" placeholder="Name your habit"
          autocomplete="off" enterkeyhint="done" aria-label="Habit name" value="${esc(draft.name)}">
      </div>
      ${
        existing
          ? ''
          : `<div class="suggest" aria-label="Suggestions">${STARTERS.map(
              (s) => `<button class="suggest-chip" type="button" data-ed="starter" data-key="${s.key}" style="${colorVars(s.color)}">${icon(s.icon)}${esc(s.name)}</button>`,
            ).join('')}</div>`
      }

      <section class="field">
        <div class="field-label"><span>Color</span><span data-ed="color-name"></span></div>
        <div class="panel swatches" role="radiogroup" aria-label="Color">
          ${COLORS.map((c) => `<button class="swatch" type="button" role="radio" data-ed="color" data-value="${c.id}" aria-label="${c.name}" style="${colorVars(c.id)}"></button>`).join('')}
        </div>
      </section>

      <section class="field">
        <div class="field-label"><span>Icon</span><span>${isWide() ? 'Scroll' : 'Swipe'} for more</span></div>
        <div class="panel"><div class="icon-grid" role="radiogroup" aria-label="Icon">
          ${HABIT_ICONS.map((n) => `<button class="icon-opt" type="button" role="radio" data-ed="icon" data-value="${n}" aria-label="${n.replace(/-/g, ' ')}">${icon(n)}</button>`).join('')}
        </div></div>
      </section>

      <section class="field">
        <div class="field-label"><span>Goal</span></div>
        <div class="panel">
          <div class="segmented" role="radiogroup" aria-label="Goal type">
            <button type="button" role="radio" data-ed="type" data-value="check">Check off</button>
            <button type="button" role="radio" data-ed="type" data-value="count">Count</button>
          </div>
          <div class="count-row" data-ed="count-row">
            <div class="stepper">
              <button class="icon-btn" type="button" data-ed="target-dec" aria-label="Decrease target">${icon('minus')}</button>
              <span class="stepper-value" data-ed="target" aria-live="polite"></span>
              <button class="icon-btn" type="button" data-ed="target-inc" aria-label="Increase target">${icon('plus')}</button>
            </div>
            <input class="unit-input" data-ed="unit" type="text" maxlength="20" placeholder="Unit, e.g. glasses" aria-label="Unit" value="${esc(draft.unit)}">
          </div>
        </div>
      </section>

      <section class="field">
        <div class="field-label"><span>Repeat</span><span data-ed="schedule"></span></div>
        <div class="panel">
          <div class="days-row">
            ${orderedDays().map((d) => `<button class="day-chip" type="button" data-ed="day" data-value="${d}" aria-label="${DOW_SHORT[d]}">${DOW_NARROW[d]}</button>`).join('')}
          </div>
          <div class="presets">
            <button class="preset" type="button" data-ed="preset" data-value="0123456">Every day</button>
            <button class="preset" type="button" data-ed="preset" data-value="12345">Weekdays</button>
            <button class="preset" type="button" data-ed="preset" data-value="06">Weekends</button>
          </div>
        </div>
      </section>

      ${
        native
          ? `<section class="field">
              <div class="field-label"><span>Reminder</span><span data-ed="reminder-label"></span></div>
              <div class="panel">
                <div class="reminder-row">
                  <span class="row-text">
                    <span class="row-title">Remind me</span>
                    <span class="row-sub">On scheduled days, unless it’s done</span>
                  </span>
                  <input class="time-input" type="time" data-ed="reminder-time" aria-label="Reminder time">
                  <button class="switch" type="button" role="switch" data-ed="reminder" aria-label="Reminder"></button>
                </div>
                <p class="reminder-warning" data-ed="reminder-warning" hidden>
                  Notifications are off for Ritual. <button type="button" data-ed="notifications">Turn on</button>
                </p>
              </div>
            </section>`
          : ''
      }

      ${existing ? `<button class="btn btn-danger btn-block editor-delete" type="button" data-ed="delete">${icon('trash-2')}Delete habit</button>` : ''}
    </div>`;

  openSheet(inner, {
    onMount(dlg, close) {
      const sheet = $('.sheet', dlg);
      const nameInput = $('[data-ed="name"]', dlg);
      let lastIcon = null;

      const paint = () => {
        setColorVars(sheet, draft.color);
        const preview = $('[data-ed="preview"]', dlg);
        if (lastIcon !== draft.icon) {
          preview.innerHTML = icon(draft.icon, lastIcon ? 'swap' : '');
          lastIcon = draft.icon;
        }
        $('[data-ed="color-name"]', dlg).textContent = colorOf(draft.color).name;
        $$('[data-ed="color"]', dlg).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === draft.color)));
        $$('[data-ed="icon"]', dlg).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === draft.icon)));
        $$('[data-ed="type"]', dlg).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === draft.type)));
        $('[data-ed="count-row"]', dlg).hidden = draft.type !== 'count';
        $('[data-ed="target"]', dlg).textContent = draft.target;
        $$('[data-ed="day"]', dlg).forEach((b) => b.setAttribute('aria-pressed', String(draft.days.includes(Number(b.dataset.value)))));
        const daysKey = [...draft.days].sort().join('');
        $$('[data-ed="preset"]', dlg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === daysKey)));
        $('[data-ed="schedule"]', dlg).textContent = draft.days.length ? scheduleLabel(draft.days) : 'Pick at least one day';
        $('[data-ed="save"]', dlg).disabled = !draft.name.trim() || !draft.days.length;
        const reminderSwitch = $('[data-ed="reminder"]', dlg);
        if (reminderSwitch) {
          const on = draft.reminder !== null;
          const time = $('[data-ed="reminder-time"]', dlg);
          reminderSwitch.setAttribute('aria-checked', String(on));
          time.hidden = !on;
          if (time.value !== draft.reminderTime) time.value = draft.reminderTime;
          $('[data-ed="reminder-label"]', dlg).textContent = on ? formatTime(draft.reminderTime) : 'Off';
          $('[data-ed="reminder-warning"]', dlg).hidden = !on || native.notificationsEnabled();
        }
      };

      const commit = () => {
        const name = draft.name.trim();
        if (!name || !draft.days.length) return;
        const data = {
          name,
          icon: draft.icon,
          color: draft.color,
          type: draft.type,
          target: draft.type === 'count' ? draft.target : 1,
          unit: draft.type === 'count' ? draft.unit.trim() : '',
          days: EVERY_DAY.filter((d) => draft.days.includes(d)),
          reminder: draft.reminder,
        };
        if (existing) {
          Object.assign(existing, data);
        } else {
          const id = uid();
          // Adding while looking at a past day lets you log that day straight away.
          state.habits.push({ id, ...data, createdAt: selKey() < todayKey ? selKey() : todayKey });
          ui.justAdded.add(id);
          requestPersistence();
        }
        save();
        haptic('success');
        close();
        render();
        refreshSheets();
        if (existing) toast('Changes saved');
      };

      sheet.addEventListener('click', (e) => {
        const el = e.target.closest('[data-ed]');
        if (!el) return;
        const v = el.dataset.value;
        switch (el.dataset.ed) {
          case 'color':
            draft.color = v;
            break;
          case 'icon':
            draft.icon = v;
            break;
          case 'type':
            draft.type = v;
            break;
          case 'target-dec':
            draft.target = Math.max(1, draft.target - 1);
            break;
          case 'target-inc':
            draft.target = Math.min(999, draft.target + 1);
            break;
          case 'day': {
            const d = Number(v);
            draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
            break;
          }
          case 'preset':
            draft.days = [...v].map(Number);
            break;
          case 'starter': {
            const s = STARTERS.find((x) => x.key === el.dataset.key);
            Object.assign(draft, { name: s.name, icon: s.icon, color: s.color, type: s.type, target: s.target ?? draft.target, unit: s.unit ?? '' });
            nameInput.value = s.name;
            $('[data-ed="unit"]', dlg).value = draft.unit;
            $(`[data-ed="icon"][data-value="${s.icon}"]`, dlg)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            break;
          }
          case 'reminder':
            draft.reminder = draft.reminder === null ? draft.reminderTime : null;
            if (draft.reminder) requestNotifications().then(paint);
            break;
          case 'notifications':
            turnOnNotifications().then(paint);
            return;
          case 'save':
            commit();
            return;
          case 'delete':
            close();
            closeAllSheets();
            deleteHabit(existing.id);
            return;
          default:
            return;
        }
        haptic('tick');
        paint();
      });

      nameInput.addEventListener('input', () => {
        draft.name = nameInput.value;
        paint();
      });
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      $('[data-ed="unit"]', dlg).addEventListener('input', (e) => {
        draft.unit = e.target.value;
      });
      $('[data-ed="reminder-time"]', dlg)?.addEventListener('input', (e) => {
        if (!TIME_RE.test(e.target.value)) return;
        draft.reminderTime = e.target.value;
        if (draft.reminder !== null) draft.reminder = e.target.value;
        paint();
      });

      paint();
      $(`[data-ed="icon"][data-value="${draft.icon}"]`, dlg)?.scrollIntoView({ inline: 'center', block: 'nearest' });
      if (!existing && matchMedia('(pointer: fine)').matches) nameInput.focus();
    },
  });
}

function deleteHabit(id) {
  const index = state.habits.findIndex((h) => h.id === id);
  if (index < 0) return;
  const [removed] = state.habits.splice(index, 1);
  const removedLogs = {};
  for (const [key, day] of Object.entries(state.logs)) {
    if (!(id in day)) continue;
    removedLogs[key] = day[id];
    setCount(id, key, 0);
  }
  save();
  render();
  toast(`Deleted “${removed.name}”`, {
    label: 'Undo',
    run() {
      state.habits.splice(index, 0, removed);
      for (const [key, n] of Object.entries(removedLogs)) setCount(id, key, n);
      save();
      render();
    },
  });
}

/* ---------- Habit detail ---------- */

function openDetail(id) {
  let h = habitById(id);
  if (!h) return;
  let month = new Date(ui.date.getFullYear(), ui.date.getMonth(), 1);

  const inner = `
    <div class="sheet-head">
      <span></span><span></span>
      <div class="head-tools">
        <button class="icon-btn" type="button" data-dt="edit" aria-label="Edit habit">${icon('pencil')}</button>
        <button class="icon-btn" type="button" data-close aria-label="Close">${icon('x')}</button>
      </div>
    </div>
    <div class="sheet-body" data-dt="body"></div>`;

  openSheet(inner, {
    onMount(dlg) {
      const sheet = $('.sheet', dlg);
      const body = $('[data-dt="body"]', dlg);

      const paint = () => {
        h = habitById(id);
        if (!h) return;
        setColorVars(sheet, h.color);
        body.innerHTML = detailHTML(h, month);
      };

      sheet.addEventListener('click', (e) => {
        const el = e.target.closest('[data-dt]');
        if (!el || !h) return;
        switch (el.dataset.dt) {
          case 'edit':
            openEditor(id);
            return;
          case 'prev':
            month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
            break;
          case 'next':
            month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
            break;
          case 'day': {
            const key = el.dataset.date;
            const done = L.isDone(state, h, key);
            setCount(h.id, key, done ? 0 : h.target);
            if (key < h.createdAt) h.createdAt = key;
            save();
            haptic(done ? 'tick' : 'success');
            render();
            break;
          }
          case 'dec':
          case 'inc': {
            const key = selKey();
            const n = L.countFor(state, h.id, key);
            setCount(h.id, key, Math.max(0, n + (el.dataset.dt === 'inc' ? 1 : -1)));
            save();
            haptic('tick');
            render();
            break;
          }
          default:
            return;
        }
        paint();
      });

      dlg.addEventListener('refresh', paint);
      paint();
    },
  });
}

function detailHTML(h, month) {
  const now = L.startOfDay();
  const streak = L.currentStreak(state, h, now);
  const best = L.bestStreak(state, h, now);
  const rate = L.completionRate(state, h, now, 30);
  const total = L.totalCompletions(state, h);
  const key = selKey();
  const count = L.countFor(state, h.id, key);

  const firstDow = (month.getDay() - state.settings.weekStart + 7) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<span></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(month.getFullYear(), month.getMonth(), day);
    const k = L.dateKey(d);
    const scheduledDay = h.days.includes(d.getDay());
    const future = k > todayKey;
    const p = L.progress(state, h, k);
    const cls = [
      'cal-day',
      p >= 1 && 'is-done',
      p > 0 && p < 1 && 'is-partial',
      (!scheduledDay || future) && 'is-off',
      k === todayKey && 'is-today',
    ]
      .filter(Boolean)
      .join(' ');
    const label = `${fmt.dayMonth.format(d)}${p >= 1 ? ', done' : ''}`;
    cells.push(
      `<button class="${cls}" type="button" data-dt="day" data-date="${k}" aria-label="${label}" ${future || !scheduledDay ? 'disabled' : ''}>${day}</button>`,
    );
  }

  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const logLabel = isTodaySelected() ? 'Today' : dayTitle(ui.date);

  return `
    <div class="detail-hero">
      <span class="habit-icon">${icon(h.icon)}</span>
      <div>
        <h2 class="detail-name">${esc(h.name)}</h2>
        <p class="detail-sub">${h.type === 'count' ? `${goalLabel(h)} · ` : ''}${scheduleLabel(h.days)}${
          native && h.reminder ? `<span class="detail-reminder">${icon('bell')}${formatTime(h.reminder)}</span>` : ''
        }</p>
      </div>
    </div>
    ${
      h.type === 'count' && L.isScheduled(h, ui.date)
        ? `<div class="panel log-panel">
            <div><div class="log-label">${esc(logLabel)}</div><div class="log-value">${count}<small> / ${h.target}${h.unit ? ` ${esc(h.unit)}` : ''}</small></div></div>
            <div class="stepper">
              <button class="icon-btn" type="button" data-dt="dec" aria-label="Subtract one" ${count ? '' : 'disabled'}>${icon('minus')}</button>
              <button class="icon-btn" type="button" data-dt="inc" aria-label="Add one">${icon('plus')}</button>
            </div>
          </div>`
        : ''
    }
    <div class="stat-row">
      <div class="stat"><div class="stat-label">${icon('flame')}Streak</div><div class="stat-value">${streak}<small>d</small></div></div>
      <div class="stat"><div class="stat-label">${icon('trophy')}Best</div><div class="stat-value">${best}<small>d</small></div></div>
      <div class="stat"><div class="stat-label">${icon('target')}30 days</div><div class="stat-value">${pct(rate)}<small>${rate === null ? '' : '%'}</small></div></div>
    </div>
    <div class="panel cal">
      <div class="cal-head">
        <span class="cal-title">${fmt.month.format(month)}</span>
        <div class="cal-nav">
          <button class="icon-btn" type="button" data-dt="prev" aria-label="Previous month">${icon('chevron-left')}</button>
          <button class="icon-btn" type="button" data-dt="next" aria-label="Next month" ${month >= thisMonth ? 'disabled' : ''}>${icon('chevron-right')}</button>
        </div>
      </div>
      <div class="cal-grid">
        ${orderedDays().map((d) => `<span class="cal-dow">${DOW_NARROW[d]}</span>`).join('')}
        ${cells.join('')}
      </div>
    </div>
    <p class="cal-hint">Tap a day to mark it done. Completed ${total} time${total === 1 ? '' : 's'} since ${fmt.dayMonth.format(L.parseKey(h.createdAt))}.</p>`;
}

/* ---------- Toast + confetti ---------- */

let toastTimer;

function toast(message, action) {
  const host = $('.toast-host');
  host.innerHTML = `<div class="toast" role="status"><span>${esc(message)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}</div>`;
  const el = host.firstElementChild;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
  const hide = () => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 350);
  };
  if (action) {
    $('button', el).addEventListener('click', () => {
      action.run();
      hide();
    });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, action ? 6000 : 2600);
}

function confetti(x, y, colors) {
  const canvas = $('.confetti');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 110 }, (_, i) => {
    const a = Math.random() * Math.PI * 2;
    const s = 3 + Math.random() * 8;
    return {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 5,
      color: colors[i % colors.length],
    };
  });
  const start = performance.now();
  const frame = (t) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.24;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.5)) + 1);
      ctx.restore();
    }
    if (elapsed < 1800) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

/* ---------- Events ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.closest('dialog')) return;
  switch (el.dataset.action) {
    case 'tab':
      if (ui.tab === el.dataset.tab) {
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
        return;
      }
      ui.tab = el.dataset.tab;
      window.scrollTo(0, 0);
      render({ enter: true });
      break;
    case 'new-habit':
      openEditor(null);
      break;
    case 'check':
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      onCheck(el);
      break;
    case 'open-habit':
      openDetail(el.dataset.id);
      break;
    case 'select-day':
      selectDate(el.dataset.date);
      break;
    case 'go-today':
      ui.date = L.startOfDay();
      render();
      scrollWeekTo(todayKey, true);
      break;
    case 'pick':
      togglePick(el);
      break;
    case 'add-picked':
      addPicked();
      break;
    case 'theme':
      state.settings.theme = el.dataset.value;
      save();
      applyTheme();
      render();
      break;
    case 'week-start':
      state.settings.weekStart = Number(el.dataset.value);
      save();
      render();
      break;
    case 'haptics':
      state.settings.haptics = !state.settings.haptics;
      save();
      el.setAttribute('aria-checked', String(state.settings.haptics));
      haptic('tick');
      break;
    case 'export':
      exportData();
      break;
    case 'export-rescue':
      exportRescue();
      break;
    case 'notifications':
      if (native.notificationsEnabled()) native.openNotificationSettings();
      else turnOnNotifications();
      break;
    case 'erase':
      eraseAll();
      break;
    case 'install':
      installEvent?.prompt();
      installEvent?.userChoice.finally(() => {
        installEvent = null;
        render();
      });
      break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-action="import"]')) importData(e.target);
});

// Long-press a check button to undo (one step for counters).
let pressTimer = null;
let pressStart = null;
let suppressClick = false;

document.addEventListener('pointerdown', (e) => {
  suppressClick = false;
  const btn = e.target.closest('.check');
  if (!btn || e.button > 0) return;
  clearTimeout(pressTimer);
  pressStart = { x: e.clientX, y: e.clientY };
  pressTimer = setTimeout(() => {
    suppressClick = true;
    decrement(btn);
  }, 480);
});

document.addEventListener('pointermove', (e) => {
  if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) clearTimeout(pressTimer);
});

['pointerup', 'pointercancel'].forEach((type) =>
  document.addEventListener(type, () => {
    clearTimeout(pressTimer);
    pressStart = null;
  }),
);

document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.check')) e.preventDefault();
});

function onScroll() {
  document.documentElement.classList.toggle('scrolled', window.scrollY > 52);
}

window.addEventListener('scroll', onScroll, { passive: true });

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  if (ui.tab === 'settings') render();
});

// Roll over to the new day if the app stays open past midnight.
function checkDayRollover() {
  const key = L.dateKey(L.startOfDay());
  if (key === todayKey) return;
  const wasToday = selKey() === todayKey;
  todayKey = key;
  if (wasToday) ui.date = L.startOfDay();
  if (!$('dialog.sheet-host')) render();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  reloadFromApp();
  checkDayRollover();
});
setInterval(checkDayRollover, 60_000);

/* ---------- Android app hooks ---------- */

// Android back button: close the top sheet, then step back to Today, then let the app exit.
window.ritualBack = () => {
  const sheets = $$('dialog.sheet-host');
  if (sheets.length) {
    sheets.at(-1).dispatchEvent(new Event('cancel', { cancelable: true }));
    return true;
  }
  if (ui.tab !== 'today') {
    ui.tab = 'today';
    window.scrollTo(0, 0);
    render({ enter: true });
    return true;
  }
  if (!isTodaySelected()) {
    ui.date = L.startOfDay();
    render();
    scrollWeekTo(todayKey, true);
    return true;
  }
  return false;
};

window.ritualBackupSaved = (ok) => toast(ok ? 'Backup saved' : 'Couldn’t save the backup');

window.ritualReload = reloadFromApp;

let notificationWaiter = null;

window.ritualNotifications = (granted) => {
  notificationWaiter?.(granted);
  notificationWaiter = null;
  if (ui.tab === 'settings' && !$('dialog.sheet-host')) render();
};

// Asks Android for notification permission if needed; resolves to whether notifications are on.
function requestNotifications() {
  if (native.notificationsEnabled()) return Promise.resolve(true);
  return new Promise((resolve) => {
    notificationWaiter = resolve;
    native.requestNotifications();
  });
}

// When the permission was refused for good, only the system settings screen can turn it back on.
async function turnOnNotifications() {
  if (!(await requestNotifications())) native.openNotificationSettings();
}

/* ---------- Boot ---------- */

applyTheme();
renderNav();
render();

if (rescuedNow) {
  toast('Some saved data couldn’t be read. A copy was kept.', {
    label: 'View',
    run() {
      ui.tab = 'settings';
      render({ enter: true });
    },
  });
}

if (!native && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
