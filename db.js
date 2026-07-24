const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'data', 'noticeboard.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'note',      -- note | task | idea
    heading TEXT NOT NULL,
    body TEXT DEFAULT '',
    checkin_date TEXT,                      -- ISO date string, nullable
    done INTEGER NOT NULL DEFAULT 0,        -- 0 | 1
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
