const PAGES = ['overview', 'tasks', 'ideas', 'calendar'];
let currentPage = 'overview';
let items = [];
let calendarEvents = [];
let calendarLoaded = false;

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

const TYPE_ICON = { note: '📝', task: '✅', idea: '💡' };

// Deterministic hash so each item always gets the same color/rotation
// across re-renders, without needing to store it anywhere.
function hashId(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function card(item, index = 0) {
  const checkin = item.checkin_date
    ? `<div class="checkin">Check in by ${fmtDate(item.checkin_date)}</div>`
    : '';
  const h = hashId(item.id);
  const swatch = h % 6;
  const rotation = ((h >> 3) % 9) - 4; // -4..4 deg
  const icon = TYPE_ICON[item.type] || '📌';

  return `
    <div class="card swatch-${swatch} ${item.done ? 'done' : ''}" data-id="${item.id}"
         style="transform: rotate(${rotation}deg); z-index: ${index + 1};">
      <div class="tape"></div>
      <div class="icon">${icon}</div>
      <div class="type-tag">${item.type}</div>
      <div class="heading">${escapeHtml(item.heading)}</div>
      ${item.body ? `<div class="body">${escapeHtml(item.body)}</div>` : ''}
      ${checkin}
    </div>`;
}

// Wraps a DOM update so Chrome/Edge can animate the before/after states
// (page crossfade, cards fading/scaling in and out) via the View
// Transitions API. Falls back to an instant update elsewhere.
function withViewTransition(renderFn) {
  if (document.startViewTransition) {
    document.startViewTransition(() => renderFn());
  } else {
    renderFn();
  }
}

// Tags each rendered card with a stable view-transition-name so the browser
// can morph/animate matching cards between renders instead of just
// crossfading the whole page.
function tagCardTransitionNames() {
  mainEl.querySelectorAll('.card[data-id]').forEach((el) => {
    el.style.viewTransitionName = `card-${el.dataset.id}`;
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function byType(type) {
  return items.filter((i) => i.type === type);
}

function renderPageInner() {
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
    if (!calendarLoaded) loadCalendarEvents();

    const withDates = items
      .filter((i) => i.checkin_date)
      .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date));

    const localCards = listOrEmptyRaw(withDates);

    const googleCards = calendarEvents.map((e, i) => {
      const h = hashId(e.id);
      const swatch = h % 6;
      const rotation = ((h >> 3) % 9) - 4;
      const when = e.allDay
        ? e.start
        : new Date(e.start).toLocaleString([], {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
      return `
        <div class="card swatch-${swatch}" style="transform: rotate(${rotation}deg); z-index: ${localCards.length + i + 1};">
          <div class="tape"></div>
          <div class="icon">📅</div>
          <div class="type-tag">google calendar</div>
          <div class="heading">${escapeHtml(e.heading)}</div>
          <div class="checkin">${when}</div>
        </div>`;
    });

    const combined = [...localCards, ...googleCards].join('');
    mainEl.innerHTML = `<div class="stack calendar-list">${combined || `<div class="empty-state">Nothing here yet</div>`}</div>`;
    return;
  }

  const typeForPage = { tasks: 'task', ideas: 'idea' }[currentPage];
  mainEl.innerHTML = `<div class="stack">${listOrEmpty(byType(typeForPage))}</div>`;
}

function renderPage() {
  renderPageInner();
  tagCardTransitionNames();
}

function updateView() {
  withViewTransition(renderPage);
}

function listOrEmpty(list) {
  if (!list.length) return `<div class="empty-state">Nothing here yet</div>`;
  return list.map((item, i) => card(item, i)).join('');
}

function listOrEmptyRaw(list) {
  return list.map((item, i) => card(item, i));
}

async function loadCalendarEvents() {
  calendarLoaded = true;
  try {
    const res = await fetch('/api/calendar/events');
    if (!res.ok) return; // not configured, or fetch failed — silently skip
    const data = await res.json();
    calendarEvents = data.events || [];
    if (currentPage === 'calendar') updateView();
  } catch {
    // Google Calendar not reachable — TV page still works with local check-in dates
  }
}

function setPage(page) {
  if (!PAGES.includes(page)) return;
  currentPage = page;
  updateView();
}

async function loadItems() {
  const res = await fetch('/api/items');
  items = await res.json();
  updateView();
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
      updateView();
    } else if (msg.event === 'item_deleted') {
      items = items.filter((i) => i.id !== msg.id);
      updateView();
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
renderPageInner();
loadItems();
connectWS();
tickClock();
setInterval(tickClock, 1000 * 30);
