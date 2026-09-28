// GitHub Issues の抽選タスクを見て、Discord 通知と締切切れの整理をする（Actions から実行）。
import { readFile, writeFile } from 'node:fs/promises';
import { GAMES } from './extract.js';
import { notify } from './discord.js';
import { STATUSES, STEPS, TASK_LABEL, dueEvents, expiredTasks, formatJst, parseTask } from './tasks.js';

const STATE = new URL('../docs/data/state.json', import.meta.url);
const SITE = 'https://shoto1998.github.io/tcg-watch/';
const COLORS = { pokemon: 0xf2c94c, onepiece: 0xeb5757, yugioh: 0x9b51e0 };

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function toEmbed({ task, heading }) {
  const lines = STEPS.map(([k, label]) => `${label}: ${task[k] ? `**${formatJst(task[k])}**` : '未確認'}`);
  lines.push(`状態: ${STATUSES[task.status] ?? task.status}`);
  if (task.applyUrl) lines.push(`[応募ページを開く](${task.applyUrl})`);
  lines.push(`[タスク一覧](${SITE})`);
  return {
    title: `${heading} ${task.title}`.slice(0, 256),
    url: task.applyUrl || task.url,
    description: lines.join('\n'),
    color: COLORS[task.game] ?? 0x828282,
    footer: { text: [GAMES[task.game]?.label, task.store].filter(Boolean).join(' ・ ') },
  };
}

async function main() {
  const now = new Date();
  const state = JSON.parse(await readFile(STATE, 'utf8'));
  const issues = await gh(`/issues?labels=${TASK_LABEL}&state=open&per_page=100`);
  const tasks = issues.filter((i) => !i.pull_request).map(parseTask);

  for (const task of expiredTasks(tasks, now)) {
    await gh(`/issues/${task.number}/labels/status:todo`, { method: 'DELETE' }).catch(() => {});
    await gh(`/issues/${task.number}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['status:expired'] }) });
    await gh(`/issues/${task.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) });
    console.log(`closed expired #${task.number}`);
  }
  const open = tasks.filter((t) => !expiredTasks([t], now).length);

  // 初回はそれまでの Issue を通知済みとして記録するだけにする
  const firstRun = !state.taskNotices;
  const notices = (state.taskNotices ??= {});
  const events = dueEvents(open, notices, now);
  for (const e of events) (notices[e.task.number] ??= []).push(e.kind);
  for (const key of Object.keys(notices)) if (!open.some((t) => String(t.number) === key)) delete notices[key];

  if (!firstRun) await notify(events.map(toEmbed));
  await writeFile(STATE, JSON.stringify(state, null, 1) + '\n');
  console.log(`tasks=${open.length} events=${events.length}${firstRun ? ' (seeded)' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
