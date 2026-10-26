// Pure date + stats helpers. No DOM access, so this module is unit-tested in tests/.
// Dates are local calendar days, keyed as 'YYYY-MM-DD' (string comparison == date order).

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfWeek(d, weekStart) {
  return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}

export function countFor(state, habitId, key) {
  return state.logs[key]?.[habitId] ?? 0;
}

export function progress(state, habit, key) {
  return Math.min(countFor(state, habit.id, key) / habit.target, 1);
}

export function isDone(state, habit, key) {
  return countFor(state, habit.id, key) >= habit.target;
}

export function isScheduled(habit, date, key = dateKey(date)) {
  return key >= habit.createdAt && habit.days.includes(date.getDay());
}

export function habitsOn(state, date) {
  const key = dateKey(date);
  return state.habits.filter((h) => isScheduled(h, date, key));
}

// Average progress across the habits scheduled that day, or null when nothing is scheduled.
export function dayProgress(state, date) {
  const habits = habitsOn(state, date);
  if (!habits.length) return null;
  const key = dateKey(date);
  return habits.reduce((sum, h) => sum + progress(state, h, key), 0) / habits.length;
}

// Consecutive scheduled days completed, counting back from `now`. Today still being open
// never breaks a streak; unscheduled days are skipped.
export function currentStreak(state, habit, now) {
  let d = now;
  if (isScheduled(habit, d) && !isDone(state, habit, dateKey(d))) d = addDays(d, -1);
  let streak = 0;
  for (let key = dateKey(d); key >= habit.createdAt; d = addDays(d, -1), key = dateKey(d)) {
    if (!isScheduled(habit, d, key)) continue;
    if (!isDone(state, habit, key)) break;
    streak++;
  }
  return streak;
}

export function bestStreak(state, habit, now) {
  const end = dateKey(now);
  let run = 0;
  let best = 0;
  for (let d = parseKey(habit.createdAt), key = habit.createdAt; key <= end; d = addDays(d, 1), key = dateKey(d)) {
    if (!isScheduled(habit, d, key)) continue;
    if (isDone(state, habit, key)) best = Math.max(best, ++run);
    else if (key !== end) run = 0;
  }
  return best;
}

// Share of scheduled days completed over the last `days` days. Today only counts once done,
// so the rate doesn't dip every morning.
function rateParts(state, habit, now, days) {
  const end = dateKey(now);
  const windowStart = dateKey(addDays(now, -(days - 1)));
  const startKey = habit.createdAt > windowStart ? habit.createdAt : windowStart;
  let hit = 0;
  let total = 0;
  for (let d = parseKey(startKey), key = startKey; key <= end; d = addDays(d, 1), key = dateKey(d)) {
    if (!isScheduled(habit, d, key)) continue;
    const done = isDone(state, habit, key);
    if (key === end && !done) continue;
    total++;
    if (done) hit++;
  }
  return { hit, total };
}

export function completionRate(state, habit, now, days = 30) {
  const { hit, total } = rateParts(state, habit, now, days);
  return total ? hit / total : null;
}

export function overallRate(state, now, days = 30) {
  let hit = 0;
  let total = 0;
  for (const h of state.habits) {
    const parts = rateParts(state, h, now, days);
    hit += parts.hit;
    total += parts.total;
  }
  return total ? hit / total : null;
}

export function totalCompletions(state, habit) {
  let n = 0;
  for (const key in state.logs) if (isDone(state, habit, key)) n++;
  return n;
}

export function earliestStart(state) {
  return state.habits.reduce((min, h) => (min === null || h.createdAt < min ? h.createdAt : min), null);
}

// true = every scheduled habit done, false = something missed, null = nothing scheduled.
export function isPerfect(state, date) {
  const habits = habitsOn(state, date);
  if (!habits.length) return null;
  const key = dateKey(date);
  return habits.every((h) => isDone(state, h, key));
}

export function perfectStreaks(state, now) {
  const start = earliestStart(state);
  if (!start) return { current: 0, best: 0 };
  const end = dateKey(now);
  let run = 0;
  let best = 0;
  for (let d = parseKey(start), key = start; key <= end; d = addDays(d, 1), key = dateKey(d)) {
    const p = isPerfect(state, d);
    if (p === true) best = Math.max(best, ++run);
    else if (p === false && key !== end) run = 0;
  }
  return { current: run, best };
}

// Done check-ins vs scheduled habit-days within [from, to].
export function checkIns(state, from, to) {
  const end = dateKey(to);
  let done = 0;
  let scheduled = 0;
  for (let d = from, key = dateKey(d); key <= end; d = addDays(d, 1), key = dateKey(d)) {
    for (const h of habitsOn(state, d)) {
      scheduled++;
      if (isDone(state, h, key)) done++;
    }
  }
  return { done, scheduled };
}

export function heatLevel(p) {
  if (p === null) return -1;
  if (p === 0) return 0;
  if (p < 0.34) return 1;
  if (p < 0.67) return 2;
  if (p < 1) return 3;
  return 4;
}
