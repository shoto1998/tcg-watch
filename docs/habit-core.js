// 習慣タスク（トレゲトで応募、月・水・金）= GitHub Issue（ラベル habit）。
// Issue を「完了」で閉じたら達成、次のタスクが出るまでに閉じなければ未達（habit:missed）として自動で閉じる。
// サイト（ブラウザ）と Actions（Node）の両方から読み込む。

export const HABIT_LABEL = 'habit';
// タスクを出す曜日（JST、0=日）。次のタスクが出るまでは前のタスクを完了にできる
export const HABIT_DAYS = [1, 3, 5];
export const HABIT_DAYS_LABEL = '月・水・金';
export const isHabitDay = (date) => HABIT_DAYS.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
export const HABIT = {
  title: 'トレゲトで抽選に応募',
  url: 'https://cardchusen.com/',
};

const BLOCK = /<!--\s*habit\s*([\s\S]*?)-->/;
const DAY = 86400_000;

// JST の日付文字列（YYYY-MM-DD）
export const jstDate = (t) => new Date(new Date(t).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

// その日を含む週の月曜（JST）
export function weekStart(date) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=日
  return addDays(date, -((dow + 6) % 7));
}

export function parseHabit(issue) {
  const m = (issue.body ?? '').match(BLOCK);
  let data = {};
  if (m) {
    try { data = JSON.parse(m[1]); } catch {}
  }
  const date = data.date ?? jstDate(issue.created_at);
  const result =
    issue.state === 'open' ? 'pending' : issue.state_reason === 'completed' ? 'done' : 'missed';
  return { number: issue.number, url: issue.html_url, date, result, closedAt: issue.closed_at };
}

export function habitBody(date) {
  return `<!-- habit\n${JSON.stringify({ date })}\n-->\n` +
    `- [ ] [トレゲト](${HABIT.url})で今日締切・新着の抽選を確認して応募する\n\n` +
    `終わったら **Close issue（完了）** で閉じるか、サイトの「完了した」を押す。次のタスク（${HABIT_DAYS_LABEL}）が出るまでに閉じないと未達になる。\n`;
}

export function dayLabel(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${'日月火水木金土'[d.getUTCDay()]})`;
}

// 週ごとの集計。pending（今日の分）は分母に入れない
export function weekStats(habits, start) {
  const end = addDays(start, 7);
  const days = habits.filter((h) => h.date >= start && h.date < end);
  const done = days.filter((h) => h.result === 'done').length;
  const settled = days.filter((h) => h.result !== 'pending').length;
  return { start, done, settled, rate: settled ? done / settled : null, days };
}

// 直近から遡った連続達成回数（まだ受付中のタスクは飛ばす）
export function streak(habits) {
  let n = 0;
  for (const h of [...habits].sort((a, b) => b.date.localeCompare(a.date))) {
    if (h.result === 'pending') continue;
    if (h.result !== 'done') break;
    n += 1;
  }
  return n;
}

export { addDays };
