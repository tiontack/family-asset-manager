const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/categories
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM categories ORDER BY sort_order ASC, id ASC'
  ).all();
  res.json(rows);
});

// POST /api/categories
router.post('/', (req, res) => {
  const db = getDb();
  const { name, color, icon, budget } = req.body;

  if (!name) return res.status(400).json({ error: '이름이 필요합니다' });

  const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m || 0;

  const result = db.prepare(
    'INSERT INTO categories (name, color, icon, budget, sort_order) VALUES (?,?,?,?,?)'
  ).run(name, color || '#6B7280', icon || '📦', budget || 0, maxSort + 1);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, color, icon, budget } = req.body;

  const result = db.prepare(
    'UPDATE categories SET name=?, color=?, icon=?, budget=? WHERE id=?'
  ).run(name, color, icon, budget || 0, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '카테고리를 찾을 수 없습니다' });
  }

  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = req.params.id;

  // 기본 카테고리 삭제 방지
  const cat = db.prepare('SELECT name FROM categories WHERE id = ?').get(id);
  const defaultNames = ['급여/수입', '기타'];
  if (cat && defaultNames.includes(cat.name)) {
    return res.status(400).json({ error: '기본 카테고리는 삭제할 수 없습니다' });
  }

  // 해당 카테고리의 거래를 '기타'로 재분류
  const otherId = db.prepare("SELECT id FROM categories WHERE name = '기타'").get()?.id;
  if (otherId) {
    db.prepare('UPDATE transactions SET category_id = ? WHERE category_id = ?').run(otherId, id);
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
