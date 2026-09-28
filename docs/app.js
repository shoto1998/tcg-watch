const LABEL = { pokemon: 'ポケカ', onepiece: 'ワンピ', yugioh: '遊戯王' };
const KEY = 'tcg-watch:applied';
const $list = document.getElementById('list');
let items = [];
let state = { sources: {} };
let tab = 'open';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let applied = new Set(load(KEY, []));

const fmt = (iso) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function games() {
  return new Set([...document.querySelectorAll('.games input:checked')].map((i) => i.value));
}

function view() {
  const now = Date.now();
  const g = games();
  const list = items.filter((i) => g.has(i.game));
  if (tab === 'sources') return renderSources();
  let rows;
  if (tab === 'product') rows = list.filter((i) => i.kind === 'product');
  else if (tab === 'applied') rows = list.filter((i) => applied.has(i.id));
  else rows = list.filter((i) => i.kind === 'lottery' && !applied.has(i.id) && (!i.deadline || new Date(i.deadline) > now));
  rows.sort((a, b) => {
    if (tab === 'open' && a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (tab === 'open' && (a.deadline || b.deadline)) return a.deadline ? -1 : 1;
    return new Date(b.firstSeen) - new Date(a.firstSeen);
  });
  $list.innerHTML = rows.length ? rows.map(card).join('') : '<p class="empty">該当なし</p>';
}

function card(i) {
  const soon = i.deadline && new Date(i.deadline) - Date.now() < 86400_000;
  const done = applied.has(i.id);
  return `<article class="item ${esc(i.game)}">
    <a class="title" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
    <div class="meta">
      <span>${LABEL[i.game] ?? ''}</span><span>${esc(i.sourceName)}</span><span>検知 ${fmt(i.firstSeen)}</span>
      ${i.deadline ? `<span class="${soon ? 'soon' : ''}">締切 ${fmt(i.deadline)}</span>` : ''}
    </div>
    <div class="actions">
      <a href="${esc(i.url)}" target="_blank" rel="noopener">${i.kind === 'lottery' ? '応募ページ' : '公式ページ'}</a>
      ${i.xSearch ? `<a href="${esc(i.xSearch)}" target="_blank" rel="noopener">Xで販売店を探す</a>` : ''}
      ${i.xStores ? `<a href="${esc(i.xStores)}" target="_blank" rel="noopener">主要店舗のXだけ</a>` : ''}
      ${i.kind === 'lottery' ? `<button data-id="${esc(i.id)}" class="${done ? 'done' : ''}">${done ? '応募済みを取消' : '応募済みにする'}</button>` : ''}
    </div>
  </article>`;
}

function renderSources() {
  const rows = Object.entries(state.sources).map(([id, s]) => `<tr>
    <td>${esc(id)}</td>
    <td class="${s.failures ? 'ng' : ''}">${s.failures ? `失敗×${s.failures}` : 'OK'}</td>
    <td>${s.lastOk ? fmt(s.lastOk) : '-'}</td><td>${s.lastCount ?? '-'}</td></tr>`).join('');
  const manual = (state.manualLinks ?? []).map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a></li>`).join('');
  $list.innerHTML = `<table><tr><th>巡回先</th><th>状態</th><th>最終成功</th><th>件数</th></tr>${rows}</table>
    ${manual ? `<h2 class="muted">自動巡回しない店舗（手動で確認）</h2><ul>${manual}</ul>` : ''}`;
}

$list.addEventListener('click', (e) => {
  const id = e.target.closest('button[data-id]')?.dataset.id;
  if (!id) return;
  applied.has(id) ? applied.delete(id) : applied.add(id);
  save(KEY, [...applied]);
  view();
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  view();
});
document.querySelector('.games').addEventListener('change', view);

Promise.all([
  fetch('data/items.json', { cache: 'no-store' }).then((r) => r.json()),
  fetch('data/state.json', { cache: 'no-store' }).then((r) => r.json()),
]).then(([i, s]) => {
  items = i; state = s;
  document.getElementById('updated').textContent = s.updatedAt ? `最終巡回 ${fmt(s.updatedAt)}` : 'まだ巡回していません';
  view();
}).catch(() => { $list.innerHTML = '<p class="empty">データを読み込めませんでした</p>'; });
