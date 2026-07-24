const PAGES = ['overview', 'tasks', 'ideas', 'calendar'];
let currentPage = 'overview';
let items = [];

const navEl = document.getElementById('nav');
const mainEl = document.getElementById('main');
const connDot = document.getElementById('conn-dot');
const clockEl = document.getElementById('clock');

function renderNav() {
  navEl.innerHTML = PAGES.map(
    (p) => `<div class="tab ${p === currentPage ? 'active' : ''}" data-page="${p}">${cap(p)}</div>`
  ).join('');
  navEl.querySelectorAll('.tab').forEach((el) => {
    el.addEventListener('click', () => setPage(el.dataset.page));
  });
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function card(item) {
  const checkin = item.checkin_date
    ? `<div class="checkin">Check in by ${fmtDate(item.checkin_date)}</div>`
    : '';
  return `
    <div class="card ${item.type} ${item.done ? 'done' : ''}">
      <div class="type-tag">${item.type}</div>
      <div class="heading">${escapeHtml(item.heading)}</div>
      ${item.body ? `<div class="body">${escapeHtml(item.body)}</div>` : ''}
      ${checkin}
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function byType(type) {
  return items.filter((i) => i.type === type);
}

function renderPage() {
  renderNav();

  if (currentPage === 'overview') {
    mainEl.innerHTML = `
      <div class="overview-columns">
        <div class="col"><h2>Tasks</h2>${listOrEmpty(byType('task'))}</div>
        <div class="col"><h2>Ideas</h2>${listOrEmpty(byType('idea'))}</div>
        <div class="col"><h2>Notes</h2>${listOrEmpty(byType('note'))}</div>
      </div>`;
    return;
  }

  if (currentPage === 'calendar') {
    const withDates = items
      .filter((i) => i.checkin_date)
      .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));
    mainEl.innerHTML = `<div class="grid calendar-list">${listOrEmpty(withDates)}</div>`;
    return;
  }

  const typeForPage = { tasks: 'task', ideas: 'idea' }[currentPage];
  mainEl.innerHTML = `<div class="grid">${listOrEmpty(byType(typeForPage))}</div>`;
}

function listOrEmpty(list) {
  if (!list.length) return `<div class="empty-state">Nothing here yet</div>`;
  return list.map(card).join('');
}

function setPage(page) {
  if (!PAGES.includes(page)) return;
  currentPage = page;
  renderPage();
}

async function loadItems() {
  const res = await fetch('/api/items');
  items = await res.json();
  renderPage();
}

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => connDot.classList.add('connected');
  ws.onclose = () => {
    connDot.classList.remove('connected');
    setTimeout(connectWS, 2000);
  };
  ws.onerror = () => ws.close();

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.event === 'navigate') {
      setPage(msg.page === 'notes' ? 'overview' : msg.page);
    } else if (msg.event === 'item_created' || msg.event === 'item_updated') {
      const idx = items.findIndex((i) => i.id === msg.item.id);
      if (idx >= 0) items[idx] = msg.item;
      else items.unshift(msg.item);
      renderPage();
    } else if (msg.event === 'item_deleted') {
      items = items.filter((i) => i.id !== msg.id);
      renderPage();
    }
  };
}

function tickClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

renderNav();
renderPage();
loadItems();
connectWS();
tickClock();
setInterval(tickClock, 1000 * 30);
