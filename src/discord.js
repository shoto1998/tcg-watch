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

// Discord と LINE のうち、Secret が登録されている方に送る（両方あれば両方）。
export async function notify(embeds, content) {
  if (!embeds.length && !content) return;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  const line = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!discord && !line) {
    console.log('[notify] 通知先が未設定のため送信しません');
    console.log(toLineText(embeds, content));
    return;
  }
  if (discord) await sendDiscord(discord, embeds, content);
  if (line) await sendLine(line, embeds, content);
}

async function sendDiscord(webhook, embeds, content) {
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

// LINE はテキストで送る。Markdown のリンク [文字](URL) は「文字 URL」に、**太字** は外す
export function toLineText(embeds, content) {
  const plain = (s = '') => s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2').replace(/\*\*/g, '');
  const blocks = embeds.map((e) => [e.title, plain(e.description), e.url && !e.description?.includes(e.url) ? e.url : '']
    .filter(Boolean).join('\n'));
  if (content) blocks.unshift(content);
  return blocks.join('\n\n');
}

async function sendLine(token, embeds, content) {
  // 無料枠（月200通）を節約するため、1回の実行で出る通知は1通にまとめる。上限5000文字
  let text = toLineText(embeds, content);
  if (text.length > 4900) text = `${text.slice(0, 4900)}\n…（続きはサイトで）`;
  // 友だちは自分だけなので broadcast で送る（ユーザーIDの取得が不要）
  const res = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) throw new Error(`LINE ${res.status}: ${await res.text()}`);
}
