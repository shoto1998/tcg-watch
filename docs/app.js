import { STATUSES, STEPS, TASK_LABEL, formatBody, formatJst as fmt, parseTask } from './task-core.js';

const REPO = 'shoto1998/tcg-watch';
const API = `https://api.github.com/repos/${REPO}`;
const LABEL = { pokemon: 'ポケカ', onepiece: 'ワンピ', yugioh: '遊戯王' };
const TOKEN_KEY = 'tcg-watch:token';
const $list = document.getElementById('list');

const load = (k) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } };
const store = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (url, text, cls = '') => (url ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${text}</a>` : '');

let tab = 'tasks';
let filter = 'action';
let tasks = [];
let closed = null;
let items = [];
let state = { sources: {} };
let token = load(TOKEN_KEY);

async function gh(path, init = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.json().catch(() => ({}))).message ?? ''}`);
  return res.status === 204 ? null : res.json();
}

const fetchTasks = async (st) =>
  (await gh(`/issues?labels=${TASK_LABEL}&state=${st}&per_page=100`)).filter((i) => !i.pull_request).map(parseTask);

// いま気にすべき期日（未応募→締切、応募済み→結果発表、当選→購入期日）
function nextDue(t) {
  const key = { todo: 'deadline', applied: 'result', won: 'purchaseBy' }[t.status];
  return key ? [key, t[key]] : [null, null];
}

function games() {
  return new Set([...document.querySelectorAll('.games input:checked')].map((i) => i.value));
}

function remaining(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms < 0) return '期限切れ';
  const h = Math.floor(ms / 3600_000);
  return h < 24 ? `あと${h}時間` : `あと${Math.floor(h / 24)}日`;
}

function timeline(t) {
  const [dueKey] = nextDue(t);
  return `<ol class="timeline">${STEPS.map(([k, label]) => {
    const past = t[k] && new Date(t[k]) < Date.now();
    const cls = k === dueKey ? 'current' : past ? 'past' : '';
    return `<li class="${cls}"><span class="step">${label}</span><span class="date">${t[k] ? fmt(t[k]) : '未確認'}</span></li>`;
  }).join('')}</ol>`;
}

const NEXT = {
  todo: [['applied', '応募した'], ['skip', '見送る']],
  applied: [['won', '当選'], ['lost', '落選']],
  won: [['bought', '購入した']],
};

function taskCard(t) {
  const [dueKey, due] = nextDue(t);
  const soon = due && new Date(due) - Date.now() < 86400_000;
  const buttons = (NEXT[t.status] ?? []).map(([s, label]) => `<button data-n="${t.number}" data-status="${s}">${label}</button>`).join('');
  return `<article class="item ${esc(t.game)}">
    <div class="head">
      <span class="badge status-${esc(t.status)}">${STATUSES[t.status] ?? esc(t.status)}</span>
      ${due ? `<span class="due ${soon ? 'soon' : ''}">${STEPS.find(([k]) => k === dueKey)[1]} ${remaining(due)}</span>` : ''}
    </div>
    <a class="title" href="${esc(t.applyUrl || t.url)}" target="_blank" rel="noopener">${esc(t.title)}</a>
    <div class="meta">
      <span>${LABEL[t.game] ?? ''}</span><span>${esc(t.store)}</span>
      <span>${t.channel === 'store' ? `店頭（${esc(t.area ?? '')}）` : 'ネット'}</span>
    </div>
    ${timeline(t)}
    ${t.conditions ? `<p class="cond">${esc(t.conditions)}</p>` : ''}
    <div class="actions">
      ${link(t.applyUrl, '応募ページ', 'primary')}
      ${link(t.sourceUrl, '情報元')}
      ${token ? buttons + `<button data-edit="${t.number}">日程を編集</button>` : link(t.url, 'GitHubで開く')}
    </div>
    ${token ? `<form class="edit" data-form="${t.number}" hidden>
      ${STEPS.map(([k, label]) => `<label>${label}<input type="datetime-local" name="${k}" value="${toLocal(t[k])}"></label>`).join('')}
      <label>応募ページURL<input type="url" name="applyUrl" value="${esc(t.applyUrl)}"></label>
      <button type="submit">保存</button>
    </form>` : ''}
  </article>`;
}

// ISO ⇔ datetime-local（JST 固定）
const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16) : '');
const fromLocal = (v) => (v ? new Date(`${v}:00+09:00`).toISOString() : null);

async function renderTasks() {
  const g = games();
  let rows;
  if (filter === 'closed') {
    closed ??= await fetchTasks('closed');
    rows = closed;
  } else {
    rows = tasks.filter((t) => ({ action: ['todo', 'won'], waiting: ['applied'], all: Object.keys(NEXT) }[filter].includes(t.status)));
  }
  rows = rows.filter((t) => !t.game || g.has(t.game));
  rows.sort((a, b) => (nextDue(a)[1] ? new Date(nextDue(a)[1]) : Infinity) - (nextDue(b)[1] ? new Date(nextDue(b)[1]) : Infinity));
  const counts = { action: tasks.filter((t) => ['todo', 'won'].includes(t.status)).length, waiting: tasks.filter((t) => t.status === 'applied').length };
  $list.innerHTML = `<nav class="chips">
      ${[['action', `要対応 ${counts.action}`], ['waiting', `結果待ち ${counts.waiting}`], ['all', 'すべて'], ['closed', '完了']]
        .map(([k, l]) => `<button data-filter="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}
    </nav>
    ${token ? '' : '<p class="hint">状態の変更は「設定」でGitHubトークンを登録すると使えます</p>'}
    ${rows.length ? rows.map(taskCard).join('') : '<p class="empty">該当なし</p>'}`;
}

function itemCard(i) {
  return `<article class="item ${esc(i.game)}">
    <a class="title" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>
    <div class="meta"><span>${LABEL[i.game] ?? ''}</span><span>${esc(i.sourceName)}</span><span>検知 ${fmt(i.firstSeen)}</span></div>
    <div class="actions">
      ${link(i.url, i.kind === 'lottery' ? '告知ページ' : '公式ページ')}
      ${link(i.xSearch, 'Xで販売店を探す')}
      ${link(i.xStores, '主要店舗のXだけ')}
    </div>
  </article>`;
}

function renderItems(kind) {
  const g = games();
  const rows = items.filter((i) => i.kind === kind && g.has(i.game)).sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
  $list.innerHTML = rows.length ? rows.map(itemCard).join('') : '<p class="empty">該当なし</p>';
}

function renderSources() {
  const rows = Object.entries(state.sources).map(([id, s]) => `<tr>
    <td>${esc(id)}</td>
    <td class="${s.failures ? 'ng' : ''}">${s.failures ? `失敗×${s.failures}` : 'OK'}</td>
    <td>${s.lastOk ? fmt(s.lastOk) : '-'}</td><td>${s.lastCount ?? '-'}</td></tr>`).join('');
  const manual = (state.manualLinks ?? []).map((l) => `<li>${link(l.url, esc(l.name))}</li>`).join('');
  $list.innerHTML = `<table><tr><th>巡回先</th><th>状態</th><th>最終成功</th><th>件数</th></tr>${rows}</table>
    ${manual ? `<h2 class="muted">自動巡回しない店舗</h2><ul>${manual}</ul>` : ''}`;
}

function renderSettings() {
  $list.innerHTML = `<section class="settings">
    <h2>GitHubトークン</h2>
    <p class="muted">タスクの状態変更と日程の編集に使います。この端末のブラウザにだけ保存されます。
      権限は tcg-watch リポジトリの Issues: Read and write だけにしてください。</p>
    <form id="token-form">
      <input type="password" name="token" placeholder="github_pat_..." value="${esc(token)}" autocomplete="off">
      <button type="submit">保存</button>
      ${token ? '<button type="button" id="token-clear">削除</button>' : ''}
    </form>
    <p id="token-msg" class="muted"></p>
  </section>`;
}

async function view() {
  try {
    if (tab === 'tasks') await renderTasks();
    else if (tab === 'product' || tab === 'lottery') renderItems(tab);
    else if (tab === 'sources') renderSources();
    else renderSettings();
  } catch (e) {
    $list.innerHTML = `<p class="empty">読み込めませんでした: ${esc(e.message)}</p>`;
  }
}

async function setStatus(n, status) {
  const t = tasks.find((x) => x.number === n);
  const labels = t.labels.filter((l) => !l.startsWith('status:')).concat(`status:${status}`);
  await gh(`/issues/${n}/labels`, { method: 'PUT', body: JSON.stringify({ labels }) });
  if (['lost', 'bought', 'skip'].includes(status)) {
    await gh(`/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: status === 'bought' ? 'completed' : 'not_planned' }) });
  }
}

async function saveEdit(n, form) {
  const issue = await gh(`/issues/${n}`);
  const t = parseTask(issue);
  const { number, title, url, state: _s, status, labels, ...data } = t;
  for (const [k] of STEPS) data[k] = fromLocal(form.elements[k].value);
  data.applyUrl = form.elements.applyUrl.value || null;
  await gh(`/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ body: formatBody(data) }) });
}

async function refresh() {
  tasks = await fetchTasks('open').catch(() => []);
  closed = null;
  await view();
}

$list.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.filter) { filter = b.dataset.filter; return view(); }
  if (b.dataset.edit) { const f = $list.querySelector(`[data-form="${b.dataset.edit}"]`); f.hidden = !f.hidden; return; }
  if (b.id === 'token-clear') { token = ''; store(TOKEN_KEY, ''); return view(); }
  if (b.dataset.status) {
    b.disabled = true;
    try { await setStatus(Number(b.dataset.n), b.dataset.status); await refresh(); }
    catch (err) { alert(`更新できませんでした: ${err.message}`); b.disabled = false; }
  }
});

$list.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.id === 'token-form') {
    token = form.elements.token.value.trim();
    store(TOKEN_KEY, token);
    const msg = document.getElementById('token-msg');
    try {
      const repo = await gh('');
      msg.textContent = repo.permissions?.push || repo.permissions?.triage ? '保存しました' : '保存しました（権限を確認できませんでした）';
    } catch (err) {
      msg.textContent = `確認に失敗しました: ${err.message}`;
    }
    return;
  }
  if (form.dataset.form) {
    try { await saveEdit(Number(form.dataset.form), form); await refresh(); }
    catch (err) { alert(`保存できませんでした: ${err.message}`); }
  }
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
  fetch('data/items.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => []),
  fetch('data/state.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ sources: {} })),
]).then(async ([i, s]) => {
  items = i;
  state = s;
  document.getElementById('updated').textContent = s.updatedAt ? `最終巡回 ${fmt(s.updatedAt)}` : 'まだ巡回していません';
  await refresh();
});
