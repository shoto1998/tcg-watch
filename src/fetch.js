export const USER_AGENT =
  'tcg-watch/1.0 (+https://github.com/shoto1998/tcg-watch; personal use, 2 requests per day)';

const robotsCache = new Map();

// User-agent: * の Disallow だけを見る簡易チェック。
export function isAllowedByRobots(robotsTxt, path) {
  let applies = false;
  const disallow = [];
  const allow = [];
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') applies = value === '*';
    else if (applies && key === 'disallow' && value) disallow.push(value);
    else if (applies && key === 'allow' && value) allow.push(value);
  }
  const longest = (rules) =>
    Math.max(-1, ...rules.filter((r) => path.startsWith(r.replace(/\*.*$/, ''))).map((r) => r.length));
  return longest(allow) >= longest(disallow);
}

async function robotsAllows(url) {
  const { origin, pathname, search } = new URL(url);
  if (!robotsCache.has(origin)) {
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      robotsCache.set(origin, res.ok ? await res.text() : '');
    } catch {
      robotsCache.set(origin, '');
    }
  }
  return isAllowedByRobots(robotsCache.get(origin), pathname + search);
}

export async function fetchHtml(url) {
  if (!(await robotsAllows(url))) throw new Error(`robots.txt で禁止: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ja' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return decodeHtml(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type'));
}

// Shift_JIS や EUC-JP のサイトがあるので、Content-Type か <meta charset> を見てデコードする。
export function decodeHtml(bytes, contentType = '') {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
  const charset =
    contentType?.match(/charset=["']?([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
