let items = [];

const itemsEl = document.getElementById('items');
const form = document.getElementById('item-form');
const commandInput = document.getElementById('command-input');
const commandReply = document.getElementById('command-reply');
const micBtn = document.getElementById('mic-btn');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const TYPE_ICON = { note: '📝', task: '✅', idea: '💡' };

function hashId(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function renderItems() {
  if (!items.length) {
    itemsEl.innerHTML = `<div class="empty-state">Nothing yet — add something above</div>`;
    return;
  }
  itemsEl.innerHTML = items
    .map((i) => {
      const h = hashId(i.id);
      const swatch = h % 6;
      const rotation = ((h >> 3) % 5) - 2; // subtle -2..2 deg, keeps buttons easy to hit
      const icon = TYPE_ICON[i.type] || '📌';
      return `
    <div class="item-row swatch-${swatch} ${i.done ? 'done' : ''}" data-id="${i.id}" style="transform: rotate(${rotation}deg);">
      <div class="tape"></div>
      <div class="item-icon">${icon}</div>
      <div class="item-main">
        <div class="item-heading">${escapeHtml(i.heading)}</div>
        <div class="item-meta">
          #${i.id} · ${i.type}${i.body ? ' · ' + escapeHtml(i.body) : ''}${i.checkin_date ? ' · check in by ' + fmtDate(i.checkin_date) : ''}
        </div>
      </div>
      ${i.done ? '' : `<button data-action="complete">Done</button>`}
      <button data-action="delete" class="danger">Delete</button>
    </div>`;
    })
    .join('');
  itemsEl.querySelectorAll('.item-row[data-id]').forEach((el) => {
    el.style.viewTransitionName = `item-${el.dataset.id}`;
  });
}

// Animates between list states in Chrome/Edge (item add/remove/reorder);
// other browsers just update instantly, no error.
function updateItems() {
  if (document.startViewTransition) {
    document.startViewTransition(() => renderItems());
  } else {
    renderItems();
  }
}

async function loadItems() {
  const res = await fetch('/api/items');
  items = await res.json();
  updateItems();
}

itemsEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('.item-row');
  const id = row.dataset.id;

  if (btn.dataset.action === 'delete') {
    await nbFetch(`/api/items/${id}`, { method: 'DELETE' });
  } else if (btn.dataset.action === 'complete') {
    await nbFetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: true }),
    });
  }
  await loadItems();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    type: document.getElementById('f-type').value,
    heading: document.getElementById('f-heading').value.trim(),
    body: document.getElementById('f-body').value.trim(),
    checkin_date: document.getElementById('f-checkin').value || null,
  };
  if (!body.heading) return;

  await nbFetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  form.reset();
  await loadItems();
});

async function sendCommand(text) {
  if (!text || !text.trim()) return;
  const res = await nbFetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim() }),
  });
  const data = await res.json();
  commandReply.textContent = data.reply || '';
  commandInput.value = '';
  await loadItems();
}

document.getElementById('command-send').addEventListener('click', () => sendCommand(commandInput.value));
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendCommand(commandInput.value);
});

// --- Web Speech API mic button ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-GB';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  micBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    recognition.start();
  });

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add('listening');
    commandReply.textContent = 'Listening…';
  };

  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('listening');
  };

  recognition.onerror = (e) => {
    commandReply.textContent = `Mic error: ${e.error}`;
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    commandInput.value = transcript;
    sendCommand(transcript);
  };
} else {
  micBtn.disabled = true;
  micBtn.title = 'Speech recognition not supported in this browser';
}

loadItems();
