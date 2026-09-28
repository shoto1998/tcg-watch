import { GAMES } from './extract.js';

const COLORS = { pokemon: 0xf2c94c, onepiece: 0xeb5757, yugioh: 0x9b51e0 };

const fmt = (iso) =>
  new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

export function toEmbed(item, heading) {
  const lines = [];
  if (item.deadline) lines.push(`締切: **${fmt(item.deadline)}**`);
  if (item.xSearch) lines.push(`[Xで販売店を探す](${item.xSearch}) ・ [主要店舗アカウントだけ](${item.xStores})`);
  return {
    title: `${heading} ${item.title}`.slice(0, 256),
    url: item.url,
    description: lines.join('\n') || undefined,
    color: COLORS[item.game] ?? 0x828282,
    footer: { text: `${GAMES[item.game]?.label ?? ''} ・ ${item.sourceName}` },
  };
}

export async function notify(embeds, content) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!embeds.length && !content) return;
  if (!webhook) {
    console.log('[discord] DISCORD_WEBHOOK_URL 未設定のため送信しません');
    for (const e of embeds) console.log(`  ${e.title} ${e.url ?? ''}`);
    if (content) console.log(`  ${content}`);
    return;
  }
  // Discord は1メッセージあたり embed 10件まで
  const chunks = embeds.length ? [] : [[]];
  for (let i = 0; i < embeds.length; i += 10) chunks.push(embeds.slice(i, i + 10));
  for (const [i, chunk] of chunks.entries()) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: i === 0 ? content : undefined, embeds: chunk }),
    });
    if (!res.ok) throw new Error(`Discord ${res.status}: ${await res.text()}`);
  }
}
