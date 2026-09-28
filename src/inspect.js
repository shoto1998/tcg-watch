// 巡回先の調整用: 指定URLのリンク一覧を「テキスト | URL」で出力する。
import * as cheerio from 'cheerio';
import { extractLinks } from './extract.js';
import { fetchHtml } from './fetch.js';

for (const url of process.argv.slice(2)) {
  console.log(`\n=== ${url}`);
  try {
    const html = await fetchHtml(url);
    console.log(`bytes=${html.length}`);
    // 規約や robots.txt を読むときは本文をそのまま出す
    if (process.env.INSPECT_TEXT) {
      const text = cheerio.load(html)('body').text().replace(/\s+/g, ' ').trim() || html;
      console.log(text.slice(0, 12000));
      continue;
    }
    for (const l of extractLinks(html, url, { minLength: 2 })) console.log(`${l.title.slice(0, 90)} | ${l.url}`);
    // JS で描画しているページ向けに、データ取得先の候補も出す
    const hints = new Set(html.match(/["'][^"'\s]*(?:\.json|\/api\/|ajax|\.js)(?:\?[^"'\s]*)?["']/gi) ?? []);
    for (const h of hints) console.log(`hint ${h}`);
  } catch (e) {
    console.log(`ERROR ${e.message}`);
  }
}
