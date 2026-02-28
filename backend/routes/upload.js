const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');
const { getDb } = require('../database');
const { classifyBatch } = require('../utils/classifier');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    file.originalname = name;
    if (!file.originalname.endsWith('.csv') && file.mimetype !== 'text/csv') {
      return cb(new Error('CSV 파일만 업로드 가능합니다'));
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 없습니다' });
    }

    const buffer = req.file.buffer;
    let content = decodeBuffer(buffer);

    // CSV 파싱 - 헤더 행 탐색
    const lines = content.split('\n');
    const headerRowIndex = lines.findIndex(line =>
      (line.includes('날짜') || line.includes('거래일')) && line.includes('금액')
    );

    if (headerRowIndex === -1) {
      return res.status(400).json({ error: '토스 CSV 형식을 인식할 수 없습니다. 헤더(날짜, 금액 컬럼)를 확인해주세요.' });
    }

    const csvContent = lines.slice(headerRowIndex).join('\n');

    let records;
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch (parseErr) {
      return res.status(400).json({ error: `CSV 파싱 오류: ${parseErr.message}` });
    }

    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'CSV에 데이터가 없습니다' });
    }

    // 컬럼 정규화
    const normalized = records.map(row => {
      const date = row['날짜'] || row['거래일자'] || row['거래일'] || '';
      const time = row['시간'] || row['거래시간'] || '';
      const type = normalizeType(row['거래유형'] || row['입출금'] || row['유형'] || '');
      const merchant = row['거래처'] || row['내용'] || row['가맹점명'] || '';
      const amountRaw = row['금액'] || row['거래금액'] || row['출금액'] || row['입금액'] || '0';
      const balanceRaw = row['잔액'] || row['거래후잔액'] || row['계좌잔액'] || '0';
      const memo = row['메모'] || row['비고'] || '';

      const amount = parseInt(String(amountRaw).replace(/[^0-9]/g, ''), 10) || 0;
      const balance = parseInt(String(balanceRaw).replace(/[^0-9]/g, ''), 10) || 0;

      // YYYY-MM-DD 또는 YYYY.MM.DD → YYYY-MM
      const normalizedDate = date.replace(/\./g, '-').trim();
      const month = normalizedDate.slice(0, 7);

      return { date: normalizedDate, time, type, merchant, amount, balance, memo, month };
    }).filter(r => r.date && r.amount > 0 && r.month.length === 7);

    if (normalized.length === 0) {
      return res.status(400).json({ error: '유효한 거래 데이터가 없습니다' });
    }

    // 자동 분류
    const classified = classifyBatch(normalized);

    // DB 삽입
    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT INTO transactions (date, time, type, merchant, amount, balance, memo, category_id, month, source_file)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);

    let inserted = 0;
    let skipped = 0;

    const insertAll = db.transaction((txs) => {
      for (const tx of txs) {
        // 중복 체크: 날짜 + 시간 + 거래처 + 금액 + 유형 조합
        const exists = db.prepare(`
          SELECT id FROM transactions
          WHERE date = ? AND time = ? AND merchant = ? AND amount = ? AND type = ?
          LIMIT 1
        `).get(tx.date, tx.time, tx.merchant, tx.amount, tx.type);

        if (exists) {
          skipped++;
          continue;
        }

        insertStmt.run(
          tx.date, tx.time, tx.type, tx.merchant,
          tx.amount, tx.balance, tx.memo,
          tx.category_id, tx.month,
          req.file.originalname
        );
        inserted++;
      }
    });

    insertAll(classified);

    // monthly_assets 집계 업데이트
    updateMonthlyAssets(db, classified);

    res.json({
      success: true,
      total: normalized.length,
      inserted,
      skipped,
      message: `${inserted}건 추가, ${skipped}건 중복 생략`,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

function decodeBuffer(buffer) {
  // UTF-8 BOM 감지
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString('utf-8');
  }
  // UTF-16 LE BOM
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return iconv.decode(buffer, 'utf-16le');
  }
  // UTF-16 BE BOM
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return iconv.decode(buffer, 'utf-16be');
  }

  // UTF-8 시도
  try {
    const utf8 = buffer.toString('utf-8');
    // 한글이 있고 깨지지 않은 경우
    if (!utf8.includes('\uFFFD') && (utf8.match(/[\uAC00-\uD7A3]/) || utf8.match(/[a-zA-Z]/))) {
      return utf8;
    }
  } catch (e) {}

  // EUC-KR 폴백
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
      SUM(CASE WHEN type = '입금' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = '출금' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE month = ?
  `);

  const upsert = db.prepare(`
    INSERT INTO monthly_assets (month, total_income, total_expense, net_savings)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET
      total_income = excluded.total_income,
      total_expense = excluded.total_expense,
      net_savings = excluded.net_savings,
      updated_at = datetime('now','localtime')
  `);

  const updateAll = db.transaction(() => {
    for (const month of months) {
      const stats = getStats.get(month);
      const income = stats?.income || 0;
      const expense = stats?.expense || 0;
      upsert.run(month, income, expense, income - expense);
    }
  });
  updateAll();
}

module.exports = router;
