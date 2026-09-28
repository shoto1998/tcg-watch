import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectGame, extractLinks, filterItems, parseDeadline, productKeyword, xSearchUrl } from '../src/extract.js';
import { isAllowedByRobots } from '../src/fetch.js';

const NOW = new Date('2026-09-27T00:00:00Z');

test('detectGame', () => {
  assert.equal(detectGame('ポケモンカードゲーム 拡張パック'), 'pokemon');
  assert.equal(detectGame('ONE PIECEカードゲーム ブースターパック'), 'onepiece');
  assert.equal(detectGame('遊戯王OCG デュエルモンスターズ'), 'yugioh');
  assert.equal(detectGame('ニンテンドースイッチ2 抽選'), null);
});

test('extractLinks は相対URLを解決し重複を除く', () => {
  const html = `<ul class="news">
    <li><a href="/a">ポケモンカード 抽選販売のお知らせ</a></li>
    <li><a href="/a">ポケモンカード 抽選販売のお知らせ</a></li>
    <li><a href="#top">トップへ戻る</a></li></ul><a href="/x">フッターのリンクです</a>`;
  const links = extractLinks(html, 'https://shop.example.jp/news/', { selector: '.news a' });
  assert.deepEqual(links, [{ title: 'ポケモンカード 抽選販売のお知らせ', url: 'https://shop.example.jp/a' }]);
});

test('filterItems は店舗では抽選系、公式では商品系だけ残す', () => {
  const links = [
    { title: 'ポケモンカードゲーム 拡張パック「テスト」抽選販売', url: 'u1' },
    { title: 'ポケモンカード 大会のお知らせ', url: 'u2' },
    { title: 'Nintendo Switch 2 抽選販売', url: 'u3' },
  ];
  assert.deepEqual(filterItems(links, { kind: 'lottery' }).map((l) => l.url), ['u1']);
  const official = [{ title: '拡張パック「テスト」', url: 'p1' }, { title: 'イベント情報', url: 'p2' }];
  assert.deepEqual(filterItems(official, { kind: 'product', game: 'pokemon' }).map((l) => l.url), ['p1']);
});

test('productKeyword と xSearchUrl', () => {
  assert.equal(productKeyword('ポケモンカードゲーム 拡張パック「ムニキスゼロ」'), 'ムニキスゼロ');
  const url = new URL(xSearchUrl('ムニキスゼロ'));
  assert.equal(url.searchParams.get('f'), 'live');
  assert.match(url.searchParams.get('q'), /"ムニキスゼロ" \(抽選 OR 予約 OR 応募\)/);
  const stores = new URL(xSearchUrl('X', ['GEO_official', 'a'])).searchParams.get('q');
  assert.equal(stores, '"X" (抽選 OR 予約 OR 応募) (from:GEO_official OR from:a)');
});

test('parseDeadline は JST として解釈する', () => {
  assert.equal(parseDeadline('受付期間：9月28日(日)10:00〜9月30日(火)23:59まで', NOW), '2026-09-30T14:59:00.000Z');
  assert.equal(parseDeadline('応募締切 2026/10/5', NOW), '2026-10-05T14:59:00.000Z');
  assert.equal(parseDeadline('1月10日まで', NOW), '2027-01-10T14:59:00.000Z');
  assert.equal(parseDeadline('10月1日発売', NOW), null);
});

test('isAllowedByRobots', () => {
  const robots = 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart\nAllow: /cart/news\n';
  assert.equal(isAllowedByRobots(robots, '/news/'), true);
  assert.equal(isAllowedByRobots(robots, '/cart/item'), false);
  assert.equal(isAllowedByRobots(robots, '/cart/news/1'), true);
  assert.equal(isAllowedByRobots('', '/any'), true);
});

test('decodeHtml は meta charset の Shift_JIS / EUC-JP を読める', async () => {
  const { decodeHtml } = await import('../src/fetch.js');
  const sjis = Uint8Array.from([...Buffer.from('<meta charset="Shift_JIS">'), 0x83, 0x7c, 0x83, 0x50, 0x83, 0x4a]);
  assert.match(decodeHtml(sjis, 'text/html'), /ポケカ/);
  const euc = Uint8Array.from([0xa5, 0xdd, 0xa5, 0xb1, 0xa5, 0xab]);
  assert.equal(decodeHtml(euc, 'text/html; charset=EUC-JP'), 'ポケカ');
  assert.equal(decodeHtml(Buffer.from('ポケカ'), null), 'ポケカ');
});
