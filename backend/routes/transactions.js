const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/transactions
router.get('/', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 50, month, category, type, search } = req.query;

  let where = 'WHERE 1=1';
  const params = [];

  if (month)    { where += ' AND t.month = ?';          params.push(month); }
  if (category) { where += ' AND t.category_id = ?';    params.push(category); }
  if (type)     { where += ' AND t.type = ?';           params.push(type); }
  if (search)   {
    where += ' AND (t.merchant LIKE ? OR t.memo LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = db.prepare(
    `SELECT COUNT(*) as c FROM transactions t ${where}`
  ).get(...params).c;

  const rows = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    ${where}
    ORDER BY t.date DESC, t.time DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ total, page: parseInt(page), limit: parseInt(limit), data: rows });
});

// GET /api/transactions/months - 데이터가 있는 월 목록
router.get('/months', (req, res) => {
  const db = getDb();
  const months = db.prepare(`
    SELECT DISTINCT month FROM transactions ORDER BY month DESC
  `).all();
  res.json(months.map(r => r.month));
});

// PUT /api/transactions/:id/category
router.put('/:id/category', (req, res) => {
  const db = getDb();
  const { category_id } = req.body;

  if (!category_id) {
    return res.status(400).json({ error: 'category_id가 필요합니다' });
  }

  const result = db.prepare(
    'UPDATE transactions SET category_id = ? WHERE id = ?'
  ).run(category_id, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: '거래를 찾을 수 없습니다' });
  }

  res.json({ success: true });
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
