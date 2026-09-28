import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitBody, jstDate, parseHabit, streak, weekStart, weekStats } from '../docs/habit-core.js';

const issue = (n, date, state, reason) => ({
  number: n, html_url: `u${n}`, state, state_reason: reason, body: habitBody(date), created_at: `${date}T00:00:00Z`,
});

test('jstDate と weekStart', () => {
  assert.equal(jstDate('2026-09-27T15:30:00Z'), '2026-09-28'); // JST 0:30
  assert.equal(weekStart('2026-09-28'), '2026-09-28'); // 月
  assert.equal(weekStart('2026-10-04'), '2026-09-28'); // 日
  assert.equal(weekStart('2026-09-30'), '2026-09-28');
});

test('parseHabit は完了・未達・未確定を見分ける', () => {
  assert.equal(parseHabit(issue(1, '2026-09-28', 'closed', 'completed')).result, 'done');
  assert.equal(parseHabit(issue(2, '2026-09-28', 'closed', 'not_planned')).result, 'missed');
  assert.equal(parseHabit(issue(3, '2026-09-28', 'open', null)).result, 'pending');
  assert.equal(parseHabit(issue(3, '2026-09-28', 'open', null)).date, '2026-09-28');
});

test('weekStats は今日の未確定を分母に入れない', () => {
  const habits = [
    issue(1, '2026-09-28', 'closed', 'completed'),
    issue(2, '2026-09-29', 'closed', 'not_planned'),
    issue(3, '2026-09-30', 'closed', 'completed'),
    issue(4, '2026-10-01', 'open', null),
    issue(5, '2026-09-27', 'closed', 'completed'), // 前週
  ].map(parseHabit);
  const w = weekStats(habits, '2026-09-28');
  assert.deepEqual([w.done, w.settled], [2, 3]);
  assert.equal(Math.round(w.rate * 100), 67);
  assert.equal(weekStats([], '2026-09-28').rate, null);
});

test('streak は今日が未完了なら昨日から数える', () => {
  const habits = [
    issue(1, '2026-09-26', 'closed', 'not_planned'),
    issue(2, '2026-09-27', 'closed', 'completed'),
    issue(3, '2026-09-28', 'closed', 'completed'),
    issue(4, '2026-09-29', 'open', null),
  ].map(parseHabit);
  assert.equal(streak(habits, '2026-09-29'), 2);
  assert.equal(streak(habits, '2026-09-28'), 2);
  assert.equal(streak(habits, '2026-09-27'), 1);
});
