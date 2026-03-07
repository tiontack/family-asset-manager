'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const { getDb } = require('../database');
const { classifyBatch } = require('../utils/classifier');
const { decryptWooriHtml, parseWooriTransactions } = require('../utils/wooriDecrypt');
const { decryptAndParseXlsx } = require('../utils/xlsxDecrypt');
const { parseKbPdf } = require('../utils/kbPdfParser');

// ── 부동산 ───────────────────────────────────────────────────────────────────
router.get('/realestate', (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM personal_realestate ORDER BY created_at DESC').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/realestate', (req, res) => {
  try {
    const { name, value, note = '' } = req.body;
    if (!name || value == null) return res.status(400).json({ error: '이름과 금액은 필수입니다' });
    const db = getDb();
    const r = db.prepare('INSERT INTO personal_realestate (name, value, note) VALUES (?,?,?)').run(name, Number(value), note);
    res.json(db.prepare('SELECT * FROM personal_realestate WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/realestate/:id', (req, res) => {
  try {
    const { name, value, note = '' } = req.body;
    const db = getDb();
    db.prepare("UPDATE personal_realestate SET name=?,value=?,note=?,updated_at=datetime('now','localtime') WHERE id=?")
      .run(name, Number(value), note, req.params.id);
    res.json(db.prepare('SELECT * FROM personal_realestate WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/realestate/:id', (req, res) => {
  try { getDb().prepare('DELETE FROM personal_realestate WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 적금 ─────────────────────────────────────────────────────────────────────
router.get('/savings', (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM personal_savings ORDER BY created_at DESC').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/savings', (req, res) => {
  try {
    const { name, monthly_amount, start_date, end_date, note = '' } = req.body;
    if (!name || !monthly_amount || !start_date || !end_date)
      return res.status(400).json({ error: '이름, 월납입액, 시작월, 종료월은 필수입니다' });
    const db = getDb();
    const r = db.prepare('INSERT INTO personal_savings (name,monthly_amount,start_date,end_date,note) VALUES (?,?,?,?,?)')
      .run(name, Number(monthly_amount), start_date, end_date, note);
    res.json(db.prepare('SELECT * FROM personal_savings WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/savings/:id', (req, res) => {
  try {
    const { name, monthly_amount, start_date, end_date, note = '' } = req.body;
    const db = getDb();
    db.prepare("UPDATE personal_savings SET name=?,monthly_amount=?,start_date=?,end_date=?,note=?,updated_at=datetime('now','localtime') WHERE id=?")
      .run(name, Number(monthly_amount), start_date, end_date, note, req.params.id);
    res.json(db.prepare('SELECT * FROM personal_savings WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/savings/:id', (req, res) => {
  try { getDb().prepare('DELETE FROM personal_savings WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 생활비 항목 ───────────────────────────────────────────────────────────────
router.get('/living-items', (req, res) => {
  try {
    const db = getDb();
    const { month, category } = req.query;
    let q = 'SELECT * FROM personal_living_items WHERE 1=1';
    const params = [];
    if (month) { q += ' AND month=?'; params.push(month); }
    if (category) { q += ' AND category=?'; params.push(category); }
    q += ' ORDER BY amount DESC, name ASC';
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/living-items', (req, res) => {
  try {
    const { category, name, amount, month, is_recurring = 0, note = '' } = req.body;
    const db = getDb();
    const r = db.prepare('INSERT INTO personal_living_items (category,name,amount,month,date,is_recurring,note) VALUES (?,?,?,?,?,?,?)')
      .run(category, name, Number(amount), month, month + '-01', is_recurring ? 1 : 0, note);
    res.json(db.prepare('SELECT * FROM personal_living_items WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/living-items/:id', (req, res) => {
  try {
    const { category, name, amount, month, is_recurring = 0, note = '' } = req.body;
    const db = getDb();
    db.prepare("UPDATE personal_living_items SET category=?,name=?,amount=?,month=?,is_recurring=?,note=?,updated_at=datetime('now','localtime') WHERE id=?")
      .run(category, name, Number(amount), month, is_recurring ? 1 : 0, note, req.params.id);
    res.json(db.prepare('SELECT * FROM personal_living_items WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/living-items/:id', (req, res) => {
  try { getDb().prepare('DELETE FROM personal_living_items WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 파일 업로드 ───────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    file.originalname = name;
    const ext = name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'html', 'htm', 'pdf'].includes(ext)) return cb(new Error('CSV, XLSX, HTML, PDF 파일만 가능합니다'));
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });
    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    const buffer = req.file.buffer;
    const password = req.body.password || '880325';

    let normalized = [];
    let fileType = '';

    if (ext === 'pdf') {
      fileType = 'kb_pdf';
      const txs = await parseKbPdf(buffer, password);
      if (txs.length === 0) return res.status(400).json({ error: 'PDF에서 거래내역을 찾을 수 없습니다. 비밀번호를 확인해주세요.' });
      normalized = txs.map(t => ({
        date: t.date, time: t.time, type: t.type, merchant: t.merchant,
        amount: t.amount, balance: t.balance, memo: t.memo, month: t.month, livingCategory: t.livingCategory,
      }));
    } else if (ext === 'html' || ext === 'htm') {
      fileType = 'woori';
      const decryptedHtml = decryptWooriHtml(buffer, password);
      const txs = parseWooriTransactions(decryptedHtml);
      if (txs.length === 0) return res.status(400).json({ error: 'HTML에서 거래내역을 찾을 수 없습니다' });
      normalized = txs.map(t => ({
        date: t.date, time: t.time, type: t.type, merchant: t.name,
        amount: t.amount, balance: t.balance, memo: '', month: t.month, livingCategory: 'management',
      }));
    } else if (ext === 'xlsx') {
      fileType = 'xlsx';
      const txs = await decryptAndParseXlsx(buffer, password);
      if (txs.length === 0) return res.status(400).json({ error: 'XLSX에서 거래내역을 찾을 수 없습니다' });
      normalized = txs.map(t => ({
        date: t.date, time: t.time, type: t.type, merchant: t.name,
        amount: t.amount, balance: t.balance, memo: t.memo || '', month: t.month, livingCategory: 'living',
      }));
    } else {
      fileType = 'csv';
      const content = decodeBuffer(buffer);
      const lines = content.split('\n');
      const headerRowIndex = lines.findIndex(l =>
        (l.includes('날짜') || l.includes('거래일') || l.includes('거래 일')) && l.includes('금액')
      );
      if (headerRowIndex === -1) return res.status(400).json({ error: 'CSV 형식을 인식할 수 없습니다' });
      let records;
      try {
        records = parse(lines.slice(headerRowIndex).join('\n'), {
          columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true,
        });
      } catch (e) { return res.status(400).json({ error: `CSV 파싱 오류: ${e.message}` }); }
      if (!records?.length) return res.status(400).json({ error: 'CSV에 데이터가 없습니다' });
      normalized = records.map(row => {
        const date = (row['날짜'] || row['거래일자'] || row['거래일'] || row['거래 일시'] || '').replace(/\./g, '-').trim();
        const amount = parseInt(String(row['금액'] || row['거래금액'] || row['거래 금액'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        const balance = parseInt(String(row['잔액'] || row['거래후잔액'] || row['거래 후 잔액'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
        return {
          date, time: row['시간'] || '',
          type: normalizeType(row['거래유형'] || row['입출금'] || row['유형'] || ''),
          merchant: row['거래처'] || row['내용'] || row['가맹점명'] || row['적요'] || '',
          amount, balance, memo: row['메모'] || '', month: date.slice(0, 7), livingCategory: 'living',
        };
      }).filter(r => r.date && r.amount > 0 && r.month.length === 7);
    }

    if (!normalized.length) return res.status(400).json({ error: '유효한 거래 데이터가 없습니다' });

    const db = getDb();
    const classified = fileType === 'woori'
      ? normalized.map(t => ({ ...t, category_id: db.prepare("SELECT id FROM categories WHERE name='관리비'").get()?.id }))
      : classifyBatch(normalized);

    const insertTx = db.prepare(`
      INSERT INTO personal_transactions (date,time,type,merchant,amount,balance,memo,category_id,month,source_file)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    const insertLi = db.prepare(`
      INSERT INTO personal_living_items (category,name,amount,month,date,is_recurring,note)
      VALUES (?,?,?,?,?,0,'')
    `);

    let txInserted = 0, txSkipped = 0, liInserted = 0, liSkipped = 0;

    db.transaction((rows) => {
      for (const tx of rows) {
        const txExists = db.prepare(`
          SELECT id FROM personal_transactions WHERE date=? AND time=? AND merchant=? AND amount=? AND type=? LIMIT 1
        `).get(tx.date, tx.time || '', tx.merchant, tx.amount, tx.type);

        if (!txExists) {
          insertTx.run(tx.date, tx.time || '', tx.type, tx.merchant, tx.amount, tx.balance, tx.memo, tx.category_id, tx.month, filename);
          txInserted++;
        } else { txSkipped++; }

        if (tx.type === '출금') {
          const liExists = db.prepare(`
            SELECT id FROM personal_living_items WHERE name=? AND amount=? AND date=? LIMIT 1
          `).get(tx.merchant, tx.amount, tx.date);
          if (!liExists) {
            insertLi.run(tx.livingCategory, tx.merchant, tx.amount, tx.month, tx.date);
            liInserted++;
          } else { liSkipped++; }
        }
      }
    })(classified);

    res.json({
      success: true, fileType,
      total: normalized.length, inserted: txInserted, skipped: txSkipped,
      livingInserted: liInserted, livingSkipped: liSkipped,
      message: `거래내역 ${txInserted}건 추가, ${txSkipped}건 중복 / 지출항목 ${liInserted}건 추가`,
    });
  } catch (err) {
    console.error('Personal upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── 분석 ─────────────────────────────────────────────────────────────────────
router.get('/analytics/living-monthly', (req, res) => {
  try {
    const { months = 12 } = req.query;
    const data = getDb().prepare(`
      SELECT month,
        SUM(CASE WHEN category='living'      THEN amount ELSE 0 END) AS living,
        SUM(CASE WHEN category='management'  THEN amount ELSE 0 END) AS management,
        SUM(amount) AS total
      FROM personal_living_items
      GROUP BY month ORDER BY month DESC LIMIT ?
    `).all(parseInt(months));
    res.json(data.reverse());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/analytics/categories', (req, res) => {
  try {
    const db = getDb();
    const { month, type = '출금' } = req.query;
    const monthFilter = month ? `AND t2.month = '${month}'` : '';
    const params = [type];
    let where = 'WHERE t.type = ?';
    if (month) { where += ' AND t.month = ?'; params.push(month); }
    const data = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, c.budget,
        SUM(t.amount) AS total, COUNT(t.id) AS count,
        ROUND(SUM(t.amount) * 100.0 / (
          SELECT SUM(amount) FROM personal_transactions t2
          WHERE t2.type = '출금' ${monthFilter}
        ), 1) AS percentage
      FROM personal_transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      ${where}
      GROUP BY t.category_id ORDER BY total DESC
    `).all(...params);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function decodeBuffer(buf) {
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return buf.slice(3).toString('utf-8');
  if (buf[0] === 0xFF && buf[1] === 0xFE) return iconv.decode(buf, 'utf-16le');
  if (buf[0] === 0xFE && buf[1] === 0xFF) return iconv.decode(buf, 'utf-16be');
  try {
    const utf8 = buf.toString('utf-8');
    if (!utf8.includes('\uFFFD') && (utf8.match(/[\uAC00-\uD7A3]/) || utf8.match(/[a-zA-Z]/))) return utf8;
  } catch (_) {}
  return iconv.decode(buf, 'euc-kr');
}

function normalizeType(s) {
  s = s.trim();
  if (s.includes('입금') || s === 'IN' || s === '수입') return '입금';
  if (s.includes('출금') || s === 'OUT' || s === '지출') return '출금';
  return s || '출금';
}

module.exports = router;
