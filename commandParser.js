const db = require('./db');

// Turns a plain-text instruction into a db action and/or a TV navigation event.
// Returns { reply, event? } — event (if present) gets broadcast over WebSocket.

const PAGES = ['overview', 'tasks', 'ideas', 'calendar', 'notes'];

function findPage(text) {
  return PAGES.find((p) => text.includes(p));
}

// Parses PowerShell-flag style syntax, e.g.
//   add-note -heading "Buy milk" -body "whole milk" -checkin 25/12/2026
// Returns { cmd: "add-note", flags: { heading, body, checkin, id } } or null.
function parseFlagSyntax(text) {
  const cmdMatch = text.match(/^([a-zA-Z][\w-]*)\s*(.*)$/);
  if (!cmdMatch) return null;
  const [, cmdRaw, rest] = cmdMatch;
  const cmd = cmdRaw.toLowerCase();
  if (!/^(add-note|add-task|add-idea|complete|delete|show)$/.test(cmd)) return null;
  if (!/-\w+\s/.test(rest + ' ')) return null; // no actual -flag present — not flag syntax

  const flags = {};
  const flagRegex = /-(\w+)\s+(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = flagRegex.exec(rest)) !== null) {
    const key = m[1].toLowerCase();
    flags[key] = m[2] !== undefined ? m[2] : m[3];
  }
  return { cmd, flags };
}

function runFlagCommand(cmd, flags) {
  if (cmd === 'show') {
    const page = (flags.page || '').toLowerCase();
    if (!PAGES.includes(page)) {
      return { reply: `Didn't recognize page "${flags.page}". Try: ${PAGES.join(', ')}` };
    }
    return { reply: `Switching TV to ${page}`, event: { event: 'navigate', page } };
  }

  if (cmd === 'add-note' || cmd === 'add-task' || cmd === 'add-idea') {
    const type = cmd.replace('add-', '');
    if (!flags.heading) return { reply: `-heading is required for ${cmd}` };

    let checkin_date = null;
    if (flags.checkin) {
      const [d, m, y] = flags.checkin.split('/');
      if (d && m && y) checkin_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const info = db
      .prepare('INSERT INTO items (type, heading, body, checkin_date) VALUES (?, ?, ?, ?)')
      .run(type, flags.heading, flags.body || '', checkin_date);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);

    return {
      reply: `Added ${type}: "${item.heading}"${checkin_date ? ` (check in by ${checkin_date})` : ''}`,
      event: { event: 'item_created', item },
    };
  }

  if (cmd === 'complete') {
    const id = Number(flags.id);
    if (!id) return { reply: '-id is required for complete' };
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) return { reply: `No item with id ${id}` };
    db.prepare(`UPDATE items SET done = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    return { reply: `Marked "${item.heading}" as done`, event: { event: 'item_updated', item } };
  }

  if (cmd === 'delete') {
    const id = Number(flags.id);
    if (!id) return { reply: '-id is required for delete' };
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!existing) return { reply: `No item with id ${id}` };
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return { reply: `Deleted "${existing.heading}"`, event: { event: 'item_deleted', id } };
  }

  return null;
}

function parseCommand(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // Terminal-style flag syntax, e.g. add-note -heading "Buy milk" -checkin 25/12/2026
  const flagCmd = parseFlagSyntax(text);
  if (flagCmd) {
    const result = runFlagCommand(flagCmd.cmd, flagCmd.flags);
    if (result) return result;
  }

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
