const express = require('express');
const db = require('../db');

module.exports = function (broadcast) {
  const router = express.Router();

  // GET /api/items?type=note
  router.get('/', (req, res) => {
    const { type } = req.query;
    const rows = type
      ? db.prepare('SELECT * FROM items WHERE type = ? ORDER BY created_at DESC').all(type)
      : db.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
    res.json(rows);
  });

  // GET /api/items/:id
  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  // POST /api/items
  router.post('/', (req, res) => {
    const { type = 'note', heading, body = '', checkin_date = null } = req.body;
    if (!heading) return res.status(400).json({ error: 'heading is required' });

    const info = db
      .prepare('INSERT INTO items (type, heading, body, checkin_date) VALUES (?, ?, ?, ?)')
      .run(type, heading, body, checkin_date);

    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
    broadcast({ event: 'item_created', item: row });
    res.status(201).json(row);
  });

  // PUT /api/items/:id
  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });

    const {
      type = existing.type,
      heading = existing.heading,
      body = existing.body,
      checkin_date = existing.checkin_date,
      done = existing.done,
    } = req.body;

    db.prepare(
      `UPDATE items SET type = ?, heading = ?, body = ?, checkin_date = ?, done = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(type, heading, body, checkin_date, done ? 1 : 0, req.params.id);

    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    broadcast({ event: 'item_updated', item: row });
    res.json(row);
  });

  // DELETE /api/items/:id
  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not found' });

    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    broadcast({ event: 'item_deleted', id: Number(req.params.id) });
    res.status(204).send();
  });

  return router;
};
