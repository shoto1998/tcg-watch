// 毎朝: 前日までの未完了を未達で閉じ、今日の習慣タスクを作って Discord に通知する。
// 月曜は前週の振り返り（完了率）も送る。
import { notify } from './discord.js';
import {
  HABIT, HABIT_LABEL, addDays, dayLabel, habitBody, jstDate, parseHabit, streak, weekStart, weekStats,
} from '../docs/habit-core.js';

const SITE = 'https://shoto1998.github.io/tcg-watch/';

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

const pct = (r) => (r === null ? '-' : `${Math.round(r * 100)}%`);

async function main() {
  const today = jstDate(Date.now());
  let issues = await gh(`/issues?labels=${HABIT_LABEL}&state=all&per_page=100`);
  issues = issues.filter((i) => !i.pull_request);

  // 前日までの未完了は未達として閉じる
  for (const i of issues) {
    const h = parseHabit(i);
    if (h.result === 'pending' && h.date < today) {
      await gh(`/issues/${i.number}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['habit:missed'] }) });
      const closed = await gh(`/issues/${i.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) });
      Object.assign(i, closed);
      console.log(`missed #${i.number} ${h.date}`);
    }
  }

  let todayIssue = issues.find((i) => parseHabit(i).date === today);
  if (!todayIssue) {
    todayIssue = await gh('/issues', {
      method: 'POST',
      body: JSON.stringify({ title: `📝 ${dayLabel(today)} ${HABIT.title}`, body: habitBody(today), labels: [HABIT_LABEL] }),
    });
    issues.push(todayIssue);
    console.log(`created #${todayIssue.number}`);
  }

  // cron-job.org からの起動と GitHub の予備スケジュールで二重に動いても、通知は1日1回にする
  const labels = (todayIssue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
  if (labels.includes('habit:notified') && process.env.FORCE_NOTIFY !== 'true') {
    console.log(`already notified #${todayIssue.number}`);
    return;
  }

  const habits = issues.map(parseHabit);
  const week = weekStats(habits, weekStart(today));
  const embeds = [{
    title: `📝 今日の${HABIT.title}`,
    url: HABIT.url,
    description: [
      `[トレゲトを開く](${HABIT.url}) → 今日締切・新着の抽選に応募`,
      `終わったら [完了を記録](${SITE}?done=${todayIssue.number}) （または [Issue](${todayIssue.html_url}) を閉じる）`,
      '',
      `連続達成: **${streak(habits, today)}日** ・ 今週: ${week.done}/${week.settled}（${pct(week.rate)}）`,
    ].join('\n'),
    color: 0x2563eb,
  }];

  // 月曜は前週の振り返り
  if (new Date(`${today}T00:00:00Z`).getUTCDay() === 1) {
    const last = weekStats(habits, addDays(weekStart(today), -7));
    const prev = weekStats(habits, addDays(weekStart(today), -14));
    const marks = [...Array(7)].map((_, k) => {
      const d = addDays(last.start, k);
      const r = habits.find((h) => h.date === d)?.result;
      return r === 'done' ? '🟩' : r === 'missed' ? '⬜' : '▫️';
    }).join('');
    const diff = last.rate !== null && prev.rate !== null ? Math.round((last.rate - prev.rate) * 100) : null;
    embeds.unshift({
      title: `📊 先週の振り返り（${dayLabel(last.start)}〜）`,
      description: [
        `完了率 **${pct(last.rate)}**（${last.done}/${last.settled}日）${diff === null ? '' : ` ・ 前週比 ${diff >= 0 ? '+' : ''}${diff}pt`}`,
        `月火水木金土日 ${marks}`,
      ].join('\n'),
      color: 0x16a34a,
    });
  }

  // LINE のボタンは普段のブラウザで開く（openExternalBrowser=1）。サイトが ?done= を見て完了を記録する
  const doneUrl = `${SITE}?done=${todayIssue.number}&openExternalBrowser=1`;
  await notify(embeds, undefined, {
    lineButtons: {
      title: `📝 ${dayLabel(today)} ${HABIT.title}`,
      text: '応募が終わったら「完了した」を押す',
      actions: [
        { label: 'トレゲトを開く', uri: `${HABIT.url}?openExternalBrowser=1` },
        { label: '完了した', uri: doneUrl },
      ],
    },
  });
  await gh(`/issues/${todayIssue.number}/labels`, { method: 'POST', body: JSON.stringify({ labels: ['habit:notified'] }) });
  console.log(`today=${today} week=${week.done}/${week.settled}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
