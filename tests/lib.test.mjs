import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lib from '../tracker/lib.js';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const now = new Date(2026, 9, 26); // Monday 26 Oct 2026

function stateWith(habits, doneByHabit) {
  const logs = {};
  for (const [id, keys] of Object.entries(doneByHabit)) {
    const habit = habits.find((h) => h.id === id);
    for (const key of keys) (logs[key] ??= {})[id] = habit.target;
  }
  return { habits, logs };
}

const water = { id: 'w', target: 1, days: EVERY_DAY, createdAt: '2026-10-01' };

test('dateKey round-trips and pads', () => {
  assert.equal(lib.dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(lib.dateKey(lib.parseKey('2026-03-29')), '2026-03-29');
  assert.equal(lib.dateKey(lib.addDays(new Date(2026, 2, 28), 2)), '2026-03-30');
});

test('startOfWeek honours Monday and Sunday starts', () => {
  assert.equal(lib.dateKey(lib.startOfWeek(now, 1)), '2026-10-26');
  assert.equal(lib.dateKey(lib.startOfWeek(now, 0)), '2026-10-25');
});

test('an unfinished today does not break the current streak', () => {
  const s = stateWith([water], { w: ['2026-10-23', '2026-10-24', '2026-10-25'] });
  assert.equal(lib.currentStreak(s, water, now), 3);
  s.logs['2026-10-26'] = { w: 1 };
  assert.equal(lib.currentStreak(s, water, now), 4);
});

test('a missed day breaks the streak', () => {
  const s = stateWith([water], { w: ['2026-10-22', '2026-10-24', '2026-10-25'] });
  assert.equal(lib.currentStreak(s, water, now), 2);
  assert.equal(lib.bestStreak(s, water, now), 2);
});

test('unscheduled days are skipped, not counted as misses', () => {
  const weekdays = { id: 'g', target: 1, days: [1, 2, 3, 4, 5], createdAt: '2026-10-01' };
  // Thu 22, Fri 23, (weekend), Mon 26
  const s = stateWith([weekdays], { g: ['2026-10-22', '2026-10-23', '2026-10-26'] });
  assert.equal(lib.currentStreak(s, weekdays, now), 3);
});

test('count habits only complete at their target', () => {
  const glasses = { id: 'c', target: 8, days: EVERY_DAY, createdAt: '2026-10-26' };
  const s = { habits: [glasses], logs: { '2026-10-26': { c: 5 } } };
  assert.equal(lib.isDone(s, glasses, '2026-10-26'), false);
  assert.equal(lib.progress(s, glasses, '2026-10-26'), 5 / 8);
  s.logs['2026-10-26'].c = 9;
  assert.equal(lib.progress(s, glasses, '2026-10-26'), 1);
});

test('completion rate ignores days before the habit existed and an open today', () => {
  const h = { ...water, createdAt: '2026-10-17' }; // 10 days incl. today
  const s = stateWith([h], { w: ['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'] });
  assert.equal(lib.completionRate(s, h, now), 6 / 9);
  s.logs['2026-10-26'] = { w: 1 };
  assert.equal(lib.completionRate(s, h, now), 7 / 10);
});

test('perfect-day streak needs every scheduled habit', () => {
  const read = { id: 'r', target: 1, days: EVERY_DAY, createdAt: '2026-10-20' };
  const w = { ...water, createdAt: '2026-10-20' };
  const s = stateWith([w, read], {
    w: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'],
    r: ['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24', '2026-10-25'],
  });
  assert.deepEqual(lib.perfectStreaks(s, now), { current: 3, best: 3 });
  assert.equal(lib.isPerfect(s, new Date(2026, 9, 22)), false);
});

test('dayProgress is null when nothing is scheduled', () => {
  const s = stateWith([water], {});
  assert.equal(lib.dayProgress(s, new Date(2026, 8, 1)), null);
  assert.equal(lib.dayProgress(s, now), 0);
});

test('heat levels bucket progress', () => {
  assert.deepEqual([null, 0, 0.2, 0.5, 0.9, 1].map(lib.heatLevel), [-1, 0, 1, 2, 3, 4]);
});
