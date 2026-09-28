import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MANUAL_LINKS, SOURCES, STORE_X_ACCOUNTS } from './sources.js';
import { extractLinks, filterItems, parseDeadline, productKeyword, xSearchUrl } from './extract.js';
import { fetchHtml, sleep } from './fetch.js';
import { notify, toEmbed } from './discord.js';

const ITEMS = new URL('../docs/data/items.json', import.meta.url);
const STATE = new URL('../docs/data/state.json', import.meta.url);
const KEEP_DAYS = 120;
const FAILURE_ALERT_AFTER = 3;
const REMIND_WITHIN_MS = 24 * 3600 * 1000;

const idOf = (url, title) => createHash('sha1').update(`${url}\n${title}`).digest('hex').slice(0, 12);
const readJson = async (u, fallback) => {
  try { return JSON.parse(await readFile(u, 'utf8')); } catch { return fallback; }
};

async function main() {
  const now = new Date();
  const items = await readJson(ITEMS, []);
  const state = await readJson(STATE, { sources: {} });
  const known = new Set(items.map((i) => i.id));
  const fresh = [];
  const alerts = [];

  for (const source of SOURCES) {
    const s = (state.sources[source.id] ??= { failures: 0, alerted: false, seeded: false });
    try {
      const html = await fetchHtml(source.url);
      const links = extractLinks(html, source.url, source);
      // 告知が0件の日は普通にあるので、リンク自体が取れないときだけ構造変化とみなす
      if (!links.length) throw new Error('リンクが0件（ページ構造の変化かJS描画）');
      const found = filterItems(links, source);
      for (const f of found) {
        const id = idOf(f.url, f.title);
        if (known.has(id)) continue;
        known.add(id);
        const item = {
          id,
          sourceId: source.id,
          sourceName: source.name,
          kind: source.kind,
          game: f.game,
          title: f.title,
          url: f.url,
          firstSeen: now.toISOString(),
          deadline: parseDeadline(f.title, now),
          xSearch: source.kind === 'product' ? xSearchUrl(productKeyword(f.title)) : null,
          xStores: source.kind === 'product' ? xSearchUrl(productKeyword(f.title), STORE_X_ACCOUNTS) : null,
          reminded: false,
        };
        items.push(item);
        // 初回巡回分は既存の告知なので通知しない
        if (s.seeded) fresh.push(item);
      }
      Object.assign(s, { failures: 0, alerted: false, seeded: true, lastOk: now.toISOString(), lastCount: found.length });
    } catch (e) {
      s.failures += 1;
      s.lastError = String(e.message ?? e);
      console.error(`[${source.id}] ${s.lastError}`);
      if (s.failures >= FAILURE_ALERT_AFTER && !s.alerted) {
        alerts.push(`⚠️ ${source.name} の巡回が${s.failures}回連続で失敗: ${s.lastError}`);
        s.alerted = true;
      }
    }
    await sleep(2000);
  }

  const dueSoon = (i) => i.deadline && !i.reminded && new Date(i.deadline) > now && new Date(i.deadline) - now <= REMIND_WITHIN_MS;
  // 検知した時点で締切が迫っているものは新着通知に締切を載せるので、リマインドは重ねない
  for (const f of fresh) if (dueSoon(f)) f.reminded = true;
  const reminders = items.filter(dueSoon);
  for (const r of reminders) r.reminded = true;

  const cutoff = now - KEEP_DAYS * 86400_000;
  const kept = items.filter((i) => new Date(i.firstSeen) >= cutoff || (i.deadline && new Date(i.deadline) >= now));

  await writeFile(ITEMS, JSON.stringify(kept, null, 1) + '\n');
  state.updatedAt = now.toISOString();
  state.manualLinks = MANUAL_LINKS;
  await writeFile(STATE, JSON.stringify(state, null, 1) + '\n');

  const embeds = [
    ...fresh.filter((i) => i.kind === 'product').map((i) => toEmbed(i, '🆕')),
    ...fresh.filter((i) => i.kind === 'lottery').map((i) => toEmbed(i, '🎟️')),
    ...reminders.map((i) => toEmbed(i, '⏰ 締切24時間以内')),
  ];
  await notify(embeds, alerts.join('\n') || undefined);
  console.log(`new=${fresh.length} reminders=${reminders.length} alerts=${alerts.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
