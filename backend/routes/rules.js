const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/rules
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM rules r
    LEFT JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC, r.id ASC
  `).all();
  res.json(rows);
});

// POST /api/rules
router.post('/', (req, res) => {
  const db = getDb();
  const { keyword, category_id, priority = 0 } = req.body;

  if (!keyword || !category_id) {
    return res.status(400).json({ error: 'keyword와 category_id가 필요합니다' });
  }

  const result = db.prepare(
    'INSERT INTO rules (keyword, category_id, priority) VALUES (?,?,?)'
  ).run(keyword, category_id, priority);

  const created = db.prepare(`
    SELECT r.*, c.name as category_name, c.color as category_color
    FROM rules r LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// PUT /api/rules/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { keyword, category_id, priority = 0 } = req.body;

  const result = db.prepare(
    'UPDATE rules SET keyword=?, category_id=?, priority=? WHERE id=?'
  ).run(keyword, category_id, priority, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '규칙을 찾을 수 없습니다' });
  }

  res.json({ success: true });
});

// DELETE /api/rules/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM rules WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
