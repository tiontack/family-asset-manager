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

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // 파일명 한글 복원
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    file.originalname = name;
    const ext = name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'html', 'htm'].includes(ext)) {
      return cb(new Error('CSV, XLSX, HTML 파일만 업로드 가능합니다'));
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload
// 지원 형식:
//   .csv  → 토스뱅크 거래내역 CSV  → transactions + living_items(living)
//   .xlsx → 토스뱅크 거래내역 XLSX → transactions + living_items(living)
//   .html → 우리은행 보안메일     → transactions + living_items(management)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다' });

    const filename = req.file.originalname;
    const ext = filename.split('.').pop().toLowerCase();
    const buffer = req.file.buffer;
    const password = '880325';

    let normalized = [];
    let fileType = '';

    // ── 파일 종류별 파싱 ───────────────────────────────────────────────────
    if (ext === 'html' || ext === 'htm') {
      // 우리은행 보안메일 복호화 + 파싱
      fileType = 'woori';
      const decryptedHtml = decryptWooriHtml(buffer, password);
      const txs = parseWooriTransactions(decryptedHtml);
      if (txs.length === 0) return res.status(400).json({ error: '우리은행 HTML에서 거래내역을 찾을 수 없습니다' });

      normalized = txs.map(t => ({
        date: t.date,
        time: t.time,
        type: t.type,
        merchant: t.name,
        amount: t.amount,
        balance: t.balance,
        memo: '',
        month: t.month,
        livingCategory: 'management',
      }));

    } else if (ext === 'xlsx') {
      // 토스뱅크 XLSX 복호화 + 파싱
      fileType = 'toss-xlsx';
      const txs = await decryptAndParseXlsx(buffer, password);
      if (txs.length === 0) return res.status(400).json({ error: 'XLSX에서 거래내역을 찾을 수 없습니다' });

      normalized = txs.map(t => ({
        date: t.date,
        time: t.time,
        type: t.type,
        merchant: t.name,
        amount: t.amount,
        balance: t.balance,
        memo: t.memo || '',
        month: t.month,
        livingCategory: 'living',
      }));

    } else {
      // CSV (토스뱅크 등)
      fileType = 'csv';
      const content = decodeBuffer(buffer);
      const lines = content.split('\n');
      const headerRowIndex = lines.findIndex(line =>
        (line.includes('날짜') || line.includes('거래일') || line.includes('거래 일')) &&
        line.includes('금액')
      );
      if (headerRowIndex === -1) {
        return res.status(400).json({ error: '토스 CSV 형식을 인식할 수 없습니다. 헤더(날짜, 금액 컬럼)를 확인해주세요.' });
      }

      let records;
      try {
        records = parse(lines.slice(headerRowIndex).join('\n'), {
          columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true,
        });
      } catch (parseErr) {
        return res.status(400).json({ error: `CSV 파싱 오류: ${parseErr.message}` });
      }
      if (!records || records.length === 0) return res.status(400).json({ error: 'CSV에 데이터가 없습니다' });

      normalized = records.map(row => {
        const date = (row['날짜'] || row['거래일자'] || row['거래일'] || row['거래 일시'] || '').replace(/\./g, '-').trim();
        const time = row['시간'] || row['거래시간'] || '';
        const type = normalizeType(row['거래유형'] || row['입출금'] || row['유형'] || row['거래 유형'] || '');
        const merchant = row['거래처'] || row['내용'] || row['가맹점명'] || row['적요'] || '';
        const amountRaw = row['금액'] || row['거래금액'] || row['출금액'] || row['입금액'] || row['거래 금액'] || '0';
        const balanceRaw = row['잔액'] || row['거래후잔액'] || row['계좌잔액'] || row['거래 후 잔액'] || '0';
        const memo = row['메모'] || row['비고'] || '';

        const amount = parseInt(String(amountRaw).replace(/[^0-9]/g, ''), 10) || 0;
        const balance = parseInt(String(balanceRaw).replace(/[^0-9]/g, ''), 10) || 0;
        const month = date.slice(0, 7);

        return { date, time, type, merchant, amount, balance, memo, month, livingCategory: 'living' };
      }).filter(r => r.date && r.amount > 0 && r.month.length === 7);
    }

    if (normalized.length === 0) return res.status(400).json({ error: '유효한 거래 데이터가 없습니다' });

    // ── 자동 분류 ───────────────────────────────────────────────────────────
    const db = getDb();

    // 우리은행 HTML은 무조건 관리비 카테고리 사용
    let classified;
    if (fileType === 'woori') {
      const mgmtCatId = db.prepare("SELECT id FROM categories WHERE name='관리비'").get()?.id;
      classified = normalized.map(t => ({ ...t, category_id: mgmtCatId }));
    } else {
      // 지출(출금)만 분류, 입금은 급여/수입으로
      classified = classifyBatch(normalized.map(t => ({ ...t, merchant: t.merchant })));
    }

    // ── DB 삽입 ─────────────────────────────────────────────────────────────
    const insertTx = db.prepare(`
      INSERT INTO transactions (date, time, type, merchant, amount, balance, memo, category_id, month, source_file)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    const insertLiving = db.prepare(`
      INSERT INTO living_items (category, name, amount, month, date, is_recurring, note)
      VALUES (?,?,?,?,?,0,'')
    `);

    let txInserted = 0, txSkipped = 0;
    let liInserted = 0, liSkipped = 0;

    const runAll = db.transaction((rows) => {
      for (const tx of rows) {
        // ── transactions 중복 체크: 날짜+시간+거래처+금액+유형 ──
        const txExists = db.prepare(`
          SELECT id FROM transactions
          WHERE date=? AND time=? AND merchant=? AND amount=? AND type=?
          LIMIT 1
        `).get(tx.date, tx.time || '', tx.merchant, tx.amount, tx.type);

        if (!txExists) {
          insertTx.run(
            tx.date, tx.time || '', tx.type, tx.merchant,
            tx.amount, tx.balance, tx.memo,
            tx.category_id, tx.month,
            filename
          );
          txInserted++;
        } else {
          txSkipped++;
        }

        // ── living_items: 출금만, 중복 체크: 이름+금액+날짜 (날짜 기준 → 같은 날 같은 금액만 중복 처리) ──
        if (tx.type === '출금') {
          const liExists = db.prepare(`
            SELECT id FROM living_items
            WHERE name=? AND amount=? AND date=?
            LIMIT 1
          `).get(tx.merchant, tx.amount, tx.date);

          if (!liExists) {
            insertLiving.run(tx.livingCategory, tx.merchant, tx.amount, tx.month, tx.date);
            liInserted++;
          } else {
            liSkipped++;
          }
        }
      }
    });

    runAll(classified);

    // ── monthly_assets 집계 업데이트 ────────────────────────────────────────
    updateMonthlyAssets(db, classified);

    const label = fileType === 'woori' ? '우리은행 관리비' : '토스뱅크 생활비';
    res.json({
      success: true,
      fileType,
      total: normalized.length,
      inserted: txInserted,
      skipped: txSkipped,
      livingInserted: liInserted,
      livingSkipped: liSkipped,
      message: `[${label}] 거래내역 ${txInserted}건 추가, ${txSkipped}건 중복 / 생활비항목 ${liInserted}건 추가`,
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
function decodeBuffer(buffer) {
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return buffer.slice(3).toString('utf-8');
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return iconv.decode(buffer, 'utf-16le');
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) return iconv.decode(buffer, 'utf-16be');
  try {
    const utf8 = buffer.toString('utf-8');
    if (!utf8.includes('\uFFFD') && (utf8.match(/[\uAC00-\uD7A3]/) || utf8.match(/[a-zA-Z]/))) return utf8;
  } catch (_) {}
  return iconv.decode(buffer, 'euc-kr');
}

function normalizeType(typeStr) {
  const s = typeStr.trim();
  if (s.includes('입금') || s === 'IN' || s === '수입') return '입금';
  if (s.includes('출금') || s === 'OUT' || s === '지출') return '출금';
  return s || '출금';
}

function updateMonthlyAssets(db, transactions) {
  const months = [...new Set(transactions.map(t => t.month))];
  const getStats = db.prepare(`
    SELECT
      SUM(CASE WHEN type='입금' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='출금' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE month=?
  `);
  const upsert = db.prepare(`
    INSERT INTO monthly_assets (month, total_income, total_expense, net_savings)
    VALUES (?,?,?,?)
    ON CONFLICT(month) DO UPDATE SET
      total_income=excluded.total_income,
      total_expense=excluded.total_expense,
      net_savings=excluded.net_savings,
      updated_at=datetime('now','localtime')
  `);
  db.transaction(() => {
    for (const month of months) {
      const s = getStats.get(month);
      const inc = s?.income || 0, exp = s?.expense || 0;
      upsert.run(month, inc, exp, inc - exp);
    }
  })();
}

module.exports = router;
