import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueEvents, expiredTasks, formatBody, parseTask } from '../src/tasks.js';
import { mergePosts } from '../src/xposts.js';

const NOW = new Date('2026-09-28T03:00:00Z'); // JST 12:00

const issue = (number, status, data) => ({
  number,
  title: `t${number}`,
  html_url: `u${number}`,
  state: 'open',
  labels: [{ name: 'tcg-task' }, { name: `status:${status}` }],
  body: formatBody(data),
});

test('formatBody と parseTask は往復できる', () => {
  const data = { store: 'ヨドバシ.com', product: '30th | BOX', channel: 'online', deadline: '2026-09-30T14:59:00.000Z' };
  const task = parseTask(issue(1, 'applied', data));
  assert.equal(task.status, 'applied');
  assert.equal(task.store, 'ヨドバシ.com');
  assert.equal(task.deadline, data.deadline);
  assert.match(formatBody(data), /30th \\\| BOX/);
});

test('parseTask は壊れた本文でも落ちない', () => {
  const t = parseTask({ number: 2, title: 'x', labels: [], body: '<!-- tcg-task {oops -->' });
  assert.equal(t.status, 'todo');
});

test('dueEvents は状態ごとの期日を一度だけ返す', () => {
  const tasks = [
    parseTask(issue(1, 'todo', { deadline: '2026-09-28T14:59:00Z' })),
    parseTask(issue(2, 'applied', { result: '2026-09-28T01:00:00Z' })),
    parseTask(issue(3, 'won', { purchaseBy: '2026-09-29T02:00:00Z' })),
    parseTask(issue(4, 'todo', { deadline: '2026-10-05T14:59:00Z' })),
  ];
  const kinds = (ev) => ev.map((e) => `${e.task.number}:${e.kind}`).sort();
  const notices = { 1: ['new'], 2: ['new'], 3: ['new'] };
  assert.deepEqual(kinds(dueEvents(tasks, notices, NOW)), ['1:deadline', '2:result', '3:purchase', '4:new']);
  const all = { 1: ['new', 'deadline'], 2: ['new', 'result'], 3: ['new', 'purchase'], 4: ['new'] };
  assert.deepEqual(dueEvents(tasks, all, NOW), []);
});

test('expiredTasks は未応募で締切を過ぎたものだけ', () => {
  const tasks = [
    parseTask(issue(1, 'todo', { deadline: '2026-09-27T14:59:00Z' })),
    parseTask(issue(2, 'applied', { deadline: '2026-09-27T14:59:00Z' })),
    parseTask(issue(3, 'todo', {})),
  ];
  assert.deepEqual(expiredTasks(tasks, NOW).map((t) => t.number), [1]);
});

test('mergePosts は重複を除き古い投稿を捨てる', () => {
  const old = [{ id: '1', createdAt: '2026-09-10T00:00:00Z' }, { id: '2', createdAt: '2026-09-27T00:00:00Z' }];
  const merged = mergePosts(old, [{ id: '2', createdAt: '2026-09-27T00:00:00Z', text: 'dup' }, { id: '3', createdAt: '2026-09-28T00:00:00Z' }], NOW);
  assert.deepEqual(merged.map((p) => p.id), ['3', '2']);
  assert.equal(merged[1].text, undefined);
});
