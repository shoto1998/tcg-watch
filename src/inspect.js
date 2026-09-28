// 巡回先の調整用: 指定URLのリンク一覧を「テキスト | URL」で出力する。
import { extractLinks } from './extract.js';
import { fetchHtml } from './fetch.js';

for (const url of process.argv.slice(2)) {
  console.log(`\n=== ${url}`);
  try {
    const html = await fetchHtml(url);
    console.log(`bytes=${html.length}`);
    for (const l of extractLinks(html, url, { minLength: 2 })) console.log(`${l.title.slice(0, 90)} | ${l.url}`);
  } catch (e) {
    console.log(`ERROR ${e.message}`);
  }
}
