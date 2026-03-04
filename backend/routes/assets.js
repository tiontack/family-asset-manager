const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const { getDb } = require('../database');
const { decryptWooriHtml, parseWooriTransactions } = require('../utils/wooriDecrypt');
const { decryptAndParseXlsx } = require('../utils/xlsxDecrypt');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─────────────────────────────────────────────
// 부동산 자산
// ─────────────────────────────────────────────

router.get('/realestate', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM assets_realestate ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/realestate', (req, res) => {
  try {
    const { name, value, note = '' } = req.body;
    if (!name || value == null) return res.status(400).json({ error: '이름과 금액은 필수입니다' });
    const db = getDb();
    const r = db.prepare('INSERT INTO assets_realestate (name, value, note) VALUES (?, ?, ?)').run(name, Number(value), note);
    res.json(db.prepare('SELECT * FROM assets_realestate WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/realestate/:id', (req, res) => {
  try {
    const { name, value, note = '' } = req.body;
    const db = getDb();
    db.prepare("UPDATE assets_realestate SET name=?, value=?, note=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(name, Number(value), note, req.params.id);
    res.json(db.prepare('SELECT * FROM assets_realestate WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/realestate/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM assets_realestate WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
// 적금/저금
// ─────────────────────────────────────────────

router.get('/savings', (req, res) => {
  try {
    res.json(getDb().prepare('SELECT * FROM assets_savings ORDER BY created_at DESC').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/savings', (req, res) => {
  try {
    const { name, monthly_amount, start_date, end_date, note = '' } = req.body;
    if (!name || !monthly_amount || !start_date || !end_date)
      return res.status(400).json({ error: '이름, 월 납입액, 시작/종료 월은 필수입니다' });
    const db = getDb();
    const r = db.prepare('INSERT INTO assets_savings (name, monthly_amount, start_date, end_date, note) VALUES (?, ?, ?, ?, ?)')
      .run(name, Number(monthly_amount), start_date, end_date, note);
    res.json(db.prepare('SELECT * FROM assets_savings WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/savings/:id', (req, res) => {
  try {
    const { name, monthly_amount, start_date, end_date, note = '' } = req.body;
    const db = getDb();
    db.prepare("UPDATE assets_savings SET name=?, monthly_amount=?, start_date=?, end_date=?, note=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(name, Number(monthly_amount), start_date, end_date, note, req.params.id);
    res.json(db.prepare('SELECT * FROM assets_savings WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/savings/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM assets_savings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
// 생활비 월별 합계 (legacy summary — deprecated but kept for compat)
// ─────────────────────────────────────────────

router.get('/living/:month', (req, res) => {
  try {
    const db = getDb();
    // 내역 기반으로 합계 계산
    const sums = db.prepare(`
      SELECT
        SUM(CASE WHEN category='living' THEN amount ELSE 0 END) as living_expense,
        SUM(CASE WHEN category='management' THEN amount ELSE 0 END) as management_fee
      FROM living_items WHERE month = ?
    `).get(req.params.month);
    res.json({
      month: req.params.month,
      living_expense: sums.living_expense || 0,
      management_fee: sums.management_fee || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
// 생활비 내역 (living_items)
// ─────────────────────────────────────────────

// GET /api/assets/living-items?month=YYYY-MM[&category=living|management]
router.get('/living-items', (req, res) => {
  try {
    const { month, category } = req.query;
    const db = getDb();
    let sql = 'SELECT * FROM living_items WHERE 1=1';
    const params = [];
    if (month) { sql += ' AND month = ?'; params.push(month); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/assets/living-items — 단건 등록
router.post('/living-items', (req, res) => {
  try {
    const { category, name, amount, month, is_recurring = 0, note = '' } = req.body;
    if (!category || !name || amount == null || !month)
      return res.status(400).json({ error: 'category, name, amount, month은 필수입니다' });
    if (!['living', 'management'].includes(category))
      return res.status(400).json({ error: 'category는 living 또는 management 입니다' });
    const db = getDb();
    const r = db.prepare(
      'INSERT INTO living_items (category, name, amount, month, is_recurring, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(category, name, Number(amount), month, is_recurring ? 1 : 0, note);
    res.json(db.prepare('SELECT * FROM living_items WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/assets/living-items/:id
router.put('/living-items/:id', (req, res) => {
  try {
    const { category, name, amount, month, is_recurring = 0, note = '' } = req.body;
    const db = getDb();
    db.prepare(
      "UPDATE living_items SET category=?, name=?, amount=?, month=?, is_recurring=?, note=?, updated_at=datetime('now','localtime') WHERE id=?"
    ).run(category, name, Number(amount), month, is_recurring ? 1 : 0, note, req.params.id);
    res.json(db.prepare('SELECT * FROM living_items WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/assets/living-items/:id
router.delete('/living-items/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM living_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
// 반복항목 → 다음 달 자동 복사
// POST /api/assets/living-items/copy-recurring
// body: { from_month: 'YYYY-MM', to_month: 'YYYY-MM' }
// ─────────────────────────────────────────────
router.post('/living-items/copy-recurring', (req, res) => {
  try {
    const { from_month, to_month } = req.body;
    if (!from_month || !to_month) return res.status(400).json({ error: 'from_month, to_month 필수' });
    const db = getDb();
    const recurring = db.prepare(
      'SELECT * FROM living_items WHERE is_recurring = 1 AND month = ?'
    ).all(from_month);
    if (recurring.length === 0) return res.json({ copied: 0 });

    const insert = db.prepare(
      'INSERT OR IGNORE INTO living_items (category, name, amount, month, is_recurring, note) VALUES (?, ?, ?, ?, 1, ?)'
    );
    // 중복 방지: 이미 같은 이름+카테고리+월이 있으면 skip
    // → 테이블에 UNIQUE 제약은 없으므로 name+category+month로 직접 체크
    const exists = db.prepare('SELECT id FROM living_items WHERE category=? AND name=? AND month=?');
    let copied = 0;
    const tx = db.transaction(() => {
      for (const item of recurring) {
        const dup = exists.get(item.category, item.name, to_month);
        if (!dup) {
          insert.run(item.category, item.name, item.amount, to_month, item.note);
          copied++;
        }
      }
    });
    tx();
    res.json({ copied });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// 파일 일괄 업로드 (CSV / XLSX / HTML)
// POST /api/assets/living-items/upload-csv   (기존 URL 유지 + 기능 확장)
// POST /api/assets/living-items/upload-file  (신규 별칭)
//
// multipart: file, month(optional), category(optional)
// - .html  → 우리은행 보안메일 복호화 → management
// - .xlsx  → 토스뱅크 거래내역 XLSX  → living (지출만)
// - .csv   → 토스뱅크/커스텀 CSV     → category 파라미터 또는 자동탐지
// ─────────────────────────────────────────────────────────────────────────────
async function handleFileUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

    const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = filename.split('.').pop().toLowerCase();
    const buf = req.file.buffer;
    const password = '880325';

    // month 파라미터가 없으면 파일에서 자동 추출
    let { month, category } = req.body;

    const db = getDb();
    const insertLiving = db.prepare(
      'INSERT INTO living_items (category, name, amount, month, is_recurring, note) VALUES (?,?,?,?,?,?)'
    );

    let inserted = 0, skipped = 0, errors = [];
    let format = 'unknown';

    // ── XLSX (토스뱅크) ──────────────────────────────────────────────────────
    if (ext === 'xlsx') {
      format = 'toss-xlsx';
      const txs = decryptAndParseXlsx(buf, password);
      const cat = category || 'living';
      const tx = db.transaction(() => {
        for (const t of txs) {
          if (t.type !== '출금') { skipped++; continue; }
          const m = month || t.month;
          if (!m) { skipped++; continue; }
          const exists = db.prepare(
            'SELECT id FROM living_items WHERE category=? AND name=? AND amount=? AND month=? LIMIT 1'
          ).get(cat, t.name, t.amount, m);
          if (exists) { skipped++; continue; }
          insertLiving.run(cat, t.name, t.amount, m, 0, t.memo || '');
          inserted++;
        }
      });
      tx();

    // ── HTML (우리은행) ──────────────────────────────────────────────────────
    } else if (ext === 'html' || ext === 'htm') {
      format = 'woori-html';
      const decrypted = decryptWooriHtml(buf, password);
      const txs = parseWooriTransactions(decrypted);
      const cat = category || 'management';
      const tx = db.transaction(() => {
        for (const t of txs) {
          if (t.type !== '출금') { skipped++; continue; }
          const m = month || t.month;
          if (!m) { skipped++; continue; }
          const exists = db.prepare(
            'SELECT id FROM living_items WHERE category=? AND name=? AND amount=? AND month=? LIMIT 1'
          ).get(cat, t.name, t.amount, m);
          if (exists) { skipped++; continue; }
          insertLiving.run(cat, t.name, t.amount, m, 0, '');
          inserted++;
        }
      });
      tx();

    // ── CSV ─────────────────────────────────────────────────────────────────
    } else {
      let text;
      if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        text = buf.slice(3).toString('utf8');
      } else {
        try {
          const utf8 = buf.toString('utf8');
          text = utf8.includes('\uFFFD') ? iconv.decode(buf, 'EUC-KR') : utf8;
        } catch (_) {
          text = iconv.decode(buf, 'EUC-KR');
        }
      }

      const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true });
      if (rows.length === 0) return res.status(400).json({ error: 'CSV 데이터가 없습니다' });

      const nh = s => s.toLowerCase().replace(/\s/g, '');
      const headers = Object.keys(rows[0]);
      const isToss = ['거래일시', '적요', '거래금액'].every(h => headers.some(k => nh(k) === h));
      format = isToss ? 'toss' : 'custom';

      const tx = db.transaction(() => {
        if (isToss) {
          const col = (row, ...cands) => {
            for (const c of cands) {
              const k = Object.keys(row).find(k => nh(k) === nh(c));
              if (k !== undefined) return (row[k] || '').toString().trim();
            }
            return '';
          };
          for (const raw of rows) {
            const name = col(raw, '적요');
            const rawAmt = col(raw, '거래 금액', '거래금액');
            const note = col(raw, '메모');
            const dtRaw = col(raw, '거래 일시', '거래일시');
            if (!name) { skipped++; continue; }
            const amtNum = Number(rawAmt.replace(/[",\s]/g, ''));
            if (isNaN(amtNum) || amtNum >= 0) { skipped++; continue; }
            const m = month || (dtRaw ? dtRaw.replace(/\./g, '-').slice(0, 7) : null);
            if (!m) { skipped++; continue; }
            const cat = category || 'living';
            const exists = db.prepare(
              'SELECT id FROM living_items WHERE category=? AND name=? AND amount=? AND month=? LIMIT 1'
            ).get(cat, name, Math.abs(amtNum), m);
            if (exists) { skipped++; continue; }
            insertLiving.run(cat, name, Math.abs(amtNum), m, 0, note);
            inserted++;
          }
        } else {
          const get = (row, ...cands) => {
            for (const c of cands) {
              const k = Object.keys(row).find(k => nh(k) === nh(c));
              if (k !== undefined) return row[k]?.toString().trim() || '';
            }
            return '';
          };
          for (const raw of rows) {
            const name = get(raw, 'name', '항목명', '이름', '내역');
            const amtStr = get(raw, 'amount', '금액');
            const catStr = get(raw, 'category', '구분', '카테고리') || category || 'living';
            const recStr = get(raw, 'is_recurring', '반복', '매월반복', '반복여부');
            const note   = get(raw, 'note', '메모', '비고');
            if (!name || !amtStr) { skipped++; continue; }
            if (!month) { skipped++; errors.push(`month 파라미터 필요: ${name}`); continue; }
            const cat = ['living', 'management'].includes(catStr) ? catStr : (category || 'living');
            const recurring = ['1', 'true', 'y', 'yes', '예', '반복'].includes(recStr.toLowerCase()) ? 1 : 0;
            const amt = Number(amtStr.replace(/[^0-9.-]/g, ''));
            if (isNaN(amt) || amt <= 0) { skipped++; errors.push(`금액 오류: ${name}`); continue; }
            insertLiving.run(cat, name, amt, month, recurring, note);
            inserted++;
          }
        }
      });
      tx();
    }

    res.json({ success: true, inserted, skipped, errors, format });
  } catch (e) {
    console.error('living upload error:', e);
    res.status(500).json({ error: e.message });
  }
}

router.post('/living-items/upload-csv',  upload.single('file'), handleFileUpload);
router.post('/living-items/upload-file', upload.single('file'), handleFileUpload);

module.exports = router;
