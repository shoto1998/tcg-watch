import * as cheerio from 'cheerio';

export const GAMES = {
  pokemon: { label: 'ポケカ', pattern: /ポケモンカード|ポケカ|pokemon card/i },
  onepiece: { label: 'ワンピ', pattern: /ワンピースカード|ONE PIECE ?カード|ONE PIECE CARD/i },
  yugioh: { label: '遊戯王', pattern: /遊戯王|YU-GI-OH/i },
};

const LOTTERY = /抽選|予約|応募|招待|受付|再販|入荷|販売のお知らせ|販売方法/;
const PRODUCT = /パック|BOX|ボックス|デッキ|ブースター|拡張|スターター|ストラクチャー|コレクション|セット/i;

export function detectGame(text) {
  for (const [id, g] of Object.entries(GAMES)) if (g.pattern.test(text)) return id;
  return null;
}

// 一覧ページから <a> を拾い、タイトルとURLの組にする。
// DOM構造に依存しないよう、selector はコンテナの絞り込みにだけ使う。
export function extractLinks(html, baseUrl, { selector = 'a', minLength = 6 } = {}) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const out = [];
  $(selector).each((_, el) => {
    const a = el.tagName === 'a' ? $(el) : $(el).find('a').first();
    const href = a.attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    const title = ($(el).text() || a.attr('title') || '').replace(/\s+/g, ' ').trim();
    if (title.length < minLength) return;
    let url;
    try { url = new URL(href, baseUrl).href; } catch { return; }
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ title: title.slice(0, 200), url });
  });
  return out;
}

// source.kind に応じて関係する告知だけ残す。
export function filterItems(links, source) {
  return links
    .map((l) => ({ ...l, game: source.game ?? detectGame(l.title) }))
    .filter((l) => {
      if (source.include && !source.include.test(l.title)) return false;
      if (source.exclude && source.exclude.test(l.title)) return false;
      if (!l.game) return false;
      return source.kind === 'product' ? PRODUCT.test(l.title) : LOTTERY.test(l.title);
    });
}

// 商品名の「」内を検索語にする。無ければ先頭の語句を使う。
export function productKeyword(title) {
  const m = title.match(/[「『]([^」』]{2,40})[」』]/);
  if (m) return m[1];
  return title.replace(/[【\[].*?[】\]]/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
}

export function xSearchUrl(keyword, accounts = []) {
  const from = accounts.length ? ` (${accounts.map((a) => `from:${a}`).join(' OR ')})` : ' -filter:replies';
  const q = `"${keyword}" (抽選 OR 予約 OR 応募)${from}`;
  return `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;
}

// 「9月30日(火)23:59まで」「2026年9月30日」「9/30 23:59」などを拾う。
// 締切らしい語の近くにある日付のうち最後のものを締切とみなす。
export function parseDeadline(text, now = new Date()) {
  const re = /(?:(\d{4})[年/.-])?(\d{1,2})[月/.](\d{1,2})日?(?:\s*[（(][^）)]{1,3}[）)])?\s*(?:(\d{1,2})[:：時](\d{2})?)?/g;
  const cue = /締切|締め切り|〆切|まで|迄|終了|〜|～|期間/;
  const idx = text.search(cue);
  if (idx < 0) return null;
  const windowText = text.slice(Math.max(0, idx - 80), idx + 80);
  const matches = [...windowText.matchAll(re)];
  if (!matches.length) return null;
  const m = matches[matches.length - 1];
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = m[1] ? Number(m[1]) : now.getFullYear();
  if (!m[1] && month < now.getMonth() + 1 - 2) year += 1;
  const hour = m[4] ? Number(m[4]) : 23;
  const min = m[5] ? Number(m[5]) : 59;
  // JST で解釈する
  const utc = Date.UTC(year, month - 1, day, hour - 9, min);
  return new Date(utc).toISOString();
}
