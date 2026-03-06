'use strict';
/**
 * 토스뱅크 XLSX 거래내역 복호화 + 파싱 유틸리티
 * - 암호화 해제: xlsx-populate (순수 Node.js, Python 불필요)
 * - 파싱: xlsx-populate sheet.usedRange().value()
 */
const XlsxPopulate = require('xlsx-populate');

/**
 * 비밀번호로 보호된 XLSX 복호화 후 거래내역 파싱
 * @param {Buffer} buffer - XLSX 파일 버퍼
 * @param {string} password - 비밀번호 (기본: '880325')
 * @returns {Promise<Array<{date,time,month,type,name,amount,balance,memo}>>}
 */
async function decryptAndParseXlsx(buffer, password = '880325') {
  const workbook = await XlsxPopulate.fromDataAsync(buffer, { password });
  const sheet = workbook.sheet(0);

  const usedRange = sheet.usedRange();
  if (!usedRange) throw new Error('빈 시트입니다');

  const rows = usedRange.value();

  // 헤더 행 탐색 (거래 일시 포함)
  const headerIdx = rows.findIndex(row =>
    row.some(cell => /거래.{0,2}일/.test(String(cell ?? '')))
  );
  if (headerIdx === -1) throw new Error('거래내역 헤더를 찾을 수 없습니다');

  const headers = rows[headerIdx].map(h => String(h ?? '').replace(/\s/g, ''));
  const col = (...names) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n.replace(/\s/g, '')));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iDt   = col('거래일시', '날짜');
  const iName = col('적요', '거래처', '내용');
  const iAmt  = col('거래금액', '금액');
  const iBal  = col('거래후잔액', '잔액');
  const iMemo = col('메모');

  const transactions = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const dtRaw = String(row[iDt] ?? '').trim();
    if (!dtRaw.match(/\d{4}[.\-]\d{2}[.\-]\d{2}/)) continue;

    const [datePart, timePart = ''] = dtRaw.split(' ');
    const date  = datePart.replace(/\./g, '-');
    const month = date.slice(0, 7);
    const name  = String(row[iName] ?? '').trim();

    const amtRaw = row[iAmt];
    const amount = typeof amtRaw === 'number'
      ? amtRaw
      : parseInt(String(amtRaw ?? '').replace(/[^0-9-]/g, ''), 10) || 0;

    const balRaw = row[iBal];
    const balance = typeof balRaw === 'number'
      ? balRaw
      : parseInt(String(balRaw ?? '').replace(/[^0-9]/g, ''), 10) || 0;

    const memo = iMemo >= 0 ? String(row[iMemo] ?? '').trim() : '';

    if (!name || amount === 0) continue;

    transactions.push({
      date, time: timePart, month,
      type: amount < 0 ? '출금' : '입금',
      name,
      amount: Math.abs(amount),
      balance,
      memo,
    });
  }
  return transactions;
}

module.exports = { decryptAndParseXlsx };
