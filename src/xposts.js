// X の抽選告知投稿を Xpoz で1日1回取得し、data/x/posts.json に追記する。
// 無料枠は一回限りの500クレジット（検索1回2クレジット）なので、検索は1回だけにする。
import { readFile, writeFile } from 'node:fs/promises';
import { ResponseType, XpozClient } from '@xpoz/xpoz';

const POSTS = new URL('../data/x/posts.json', import.meta.url);
const KEEP_DAYS = 7;
export const QUERY = '(ポケカ OR ポケモンカード OR ワンピースカード OR ワンピカード OR 遊戯王) AND (抽選 OR 予約受付 OR 応募受付)';

const jstDate = (d) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export function mergePosts(existing, fetched, now = new Date()) {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const p of fetched) if (p.id && !byId.has(p.id)) byId.set(p.id, { ...p, fetchedAt: now.toISOString() });
  const cutoff = now.getTime() - KEEP_DAYS * 86400_000;
  return [...byId.values()]
    .filter((p) => new Date(p.createdAt ?? p.fetchedAt).getTime() >= cutoff)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function main() {
  if (!process.env.XPOZ_API_KEY) throw new Error('XPOZ_API_KEY が未設定です');
  const now = new Date();
  const client = new XpozClient();
  await client.connect();
  let fetched;
  try {
    const res = await client.twitter.searchPosts(QUERY, {
      startDate: jstDate(new Date(now.getTime() - 86400_000)),
      language: 'ja',
      filterOutRetweets: true,
      responseType: ResponseType.Fast,
      limit: 300,
      fields: ['id', 'text', 'authorUsername', 'createdAt', 'urls'],
    });
    fetched = res.data.map((p) => ({
      id: String(p.id),
      author: p.authorUsername,
      createdAt: p.createdAt,
      text: p.text,
      urls: p.urls ?? [],
      url: `https://x.com/${p.authorUsername}/status/${p.id}`,
    }));
  } finally {
    await client.close();
  }
  let existing = [];
  try { existing = JSON.parse(await readFile(POSTS, 'utf8')); } catch {}
  const merged = mergePosts(existing, fetched, now);
  await writeFile(POSTS, JSON.stringify(merged, null, 1) + '\n');
  console.log(`fetched=${fetched.length} stored=${merged.length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
