const db = require('./db');

// Turns a plain-text instruction into a db action and/or a TV navigation event.
// Returns { reply, event? } — event (if present) gets broadcast over WebSocket.

const PAGES = ['overview', 'tasks', 'ideas', 'calendar', 'notes'];

function findPage(text) {
  return PAGES.find((p) => text.includes(p));
}

function parseCommand(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // "show <page>" / "go to <page>" / "switch to <page>" / "open <page>"
  if (/^(show|go to|switch to|open)\b/.test(lower)) {
    const page = findPage(lower);
    if (page) {
      return { reply: `Switching TV to ${page}`, event: { event: 'navigate', page } };
    }
    return { reply: `Didn't recognize a page in "${text}". Try: ${PAGES.join(', ')}` };
  }

  // "add note: buy milk" / "add task: call plumber" / "add idea: paint shed"
  const addMatch = lower.match(/^add (note|task|idea)s?\s*[:\-]?\s*(.+)$/);
  if (addMatch) {
    const [, type, rest] = addMatch;
    // optional "... check in by dd/mm/yyyy" suffix
    const checkinMatch = rest.match(/^(.*?)\s+check ?in by\s+(\d{1,2}\/\d{1,2}\/\d{4})$/i);
    let heading = rest;
    let checkin_date = null;
    if (checkinMatch) {
      heading = checkinMatch[1].trim();
      const [d, m, y] = checkinMatch[2].split('/');
      checkin_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const info = db
      .prepare('INSERT INTO items (type, heading, checkin_date) VALUES (?, ?, ?)')
      .run(type, heading.trim(), checkin_date);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);

    return {
      reply: `Added ${type}: "${item.heading}"${checkin_date ? ` (check in by ${checkin_date})` : ''}`,
      event: { event: 'item_created', item },
    };
  }

  // "complete <id>" / "done <id>"
  const doneMatch = lower.match(/^(complete|done)\s+(\d+)$/);
  if (doneMatch) {
    const id = Number(doneMatch[2]);
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) return { reply: `No item with id ${id}` };
    db.prepare(`UPDATE items SET done = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    return { reply: `Marked "${item.heading}" as done`, event: { event: 'item_updated', item } };
  }

  // "delete <id>"
  const deleteMatch = lower.match(/^delete\s+(\d+)$/);
  if (deleteMatch) {
    const id = Number(deleteMatch[1]);
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) return { reply: `No item with id ${id}` };
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return { reply: `Deleted "${existing.heading}"`, event: { event: 'item_deleted', id } };
  }

  return { reply: `Didn't understand: "${text}"` };
}

module.exports = { parseCommand };
