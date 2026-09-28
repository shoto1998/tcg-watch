// 抽選タスク = GitHub Issue（ラベル tcg-task）。サイト（ブラウザ）と Actions（Node）の両方から読み込む。
// 本文先頭の <!-- tcg-task {...} --> に日程などを JSON で持ち、ルーティンとサイトの両方がここを読み書きする。

export const TASK_LABEL = 'tcg-task';
export const STATUSES = {
  todo: '未応募',
  applied: '応募済み',
  won: '当選',
  lost: '落選',
  bought: '購入済み',
  skip: '見送り',
  expired: '締切切れ',
};
export const STEPS = [
  ['start', '受付開始'],
  ['deadline', '締切'],
  ['result', '結果発表'],
  ['purchaseBy', '購入期日'],
];

const BLOCK = /<!--\s*tcg-task\s*([\s\S]*?)-->/;

export function parseTask(issue) {
  const m = (issue.body ?? '').match(BLOCK);
  let data = {};
  if (m) {
    try { data = JSON.parse(m[1]); } catch { data = {}; }
  }
  const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  const status = labels.find((l) => l.startsWith('status:'))?.slice(7) ?? 'todo';
  return { number: issue.number, title: issue.title, url: issue.html_url, state: issue.state, status, labels, ...data };
}

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : '未確認';

// Issue 本文を組み立てる。人が GitHub アプリで読んでも分かるよう表も付ける。
export function formatBody(data) {
  const rows = [
    ['店舗', data.store],
    ['商品', data.product],
    ['応募方法', data.channel === 'store' ? `店頭（${data.area ?? '地域未確認'}）` : 'ネット'],
    ...STEPS.map(([k, label]) => [label, fmt(data[k])]),
    ['応募条件', data.conditions],
    ['応募ページ', data.applyUrl],
    ['情報元', data.sourceUrl],
  ].filter(([, v]) => v);
  const table = ['| 項目 | 内容 |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`)];
  return `<!-- tcg-task\n${JSON.stringify(data, null, 1)}\n-->\n${table.join('\n')}\n`;
}

const DAY = 86400_000;
const jstDay = (t) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);

// 通知すべきイベントを返す。notices は { [issue番号]: ['new', 'deadline', ...] }。
export function dueEvents(tasks, notices, now = new Date()) {
  const t = now.getTime();
  const events = [];
  const soon = (iso) => iso && new Date(iso).getTime() > t && new Date(iso).getTime() - t <= DAY;
  for (const task of tasks) {
    const sent = new Set(notices[task.number] ?? []);
    const push = (kind, heading) => !sent.has(kind) && events.push({ task, kind, heading });
    push('new', '🎟️ 新しい抽選');
    if (task.status === 'todo' && soon(task.deadline)) push('deadline', '⏰ 締切まで24時間以内');
    if (task.status === 'applied' && task.result && jstDay(new Date(task.result).getTime()) <= jstDay(t)) push('result', '📣 結果発表日です');
    if (task.status === 'won' && soon(task.purchaseBy)) push('purchase', '🛒 購入期日まで24時間以内');
  }
  return events;
}

// 未応募のまま締切を過ぎたものは閉じる。
export function expiredTasks(tasks, now = new Date()) {
  return tasks.filter((x) => x.status === 'todo' && x.deadline && new Date(x.deadline) < now);
}

export { fmt as formatJst };
