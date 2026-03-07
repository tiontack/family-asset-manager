'use strict';

const { PDFParse } = require('pdf-parse');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

/**
 * KB국민은행 PDF 거래내역 파서
 *
 * 한 줄 예시:
 *   2026.03.06 00:40:47 체크카드 네이버페이 125,000 0 96,923 - KB카드
 *   2026.03.05 19:56:34 CMS 공동 DB손03003 16,900 0 221,923 - ERP사
 *   2026.03.02 20:23:14 FBS 출금 쿠팡 15,900 0 7,338,570 - ERP사
 *   2026.02.15 13:25:03 ATM출금 1,000,000 0 475,247 - 일반업
 *
 * 필드: 거래일 시간 [적요] [거래처] 출금액 입금액 잔액 메모 거래점
 */

// 2단어로 구성된 KB 적요 목록 (공백 포함)
const TWO_WORD_TYPES = new Set([
  'CMS 공동', 'FBS 출금', 'TOP 일반', '오픈뱅킹 출금',
  '인터넷 뱅킹', '자동 이체', '인터넷 이체', 'TOP 이체',
]);

// YYYY.MM.DD HH:MM:SS <중간텍스트> 출금 입금 잔액 메모 거래점
const TX_RE = /^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\S+)\s+(\S+)$/;

/**
 * @param {Buffer} buffer   - PDF 파일 버퍼
 * @param {string} password - PDF 비밀번호 (기본값 '880325')
 * @returns {Promise<Array>} 정규화된 거래 배열
 */
async function parseKbPdf(buffer, password = '880325') {
  const tmpFile = path.join(os.tmpdir(), `kb_pdf_${Date.now()}.pdf`);
  fs.writeFileSync(tmpFile, buffer);

  try {
    const parser = new PDFParse({ url: tmpFile, password });
    const result = await parser.getText();
    return parseKbText(result.text);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

/** 적요(1~2단어)와 거래처 분리 */
function splitTypeAndMerchant(middle) {
  const parts = middle.split(/\s+/);
  if (parts.length === 1) {
    return { rawType: parts[0], merchant: parts[0] };
  }

  // 2단어 적요 체크 (ex: "CMS 공동", "FBS 출금")
  const twoWordKey = `${parts[0]} ${parts[1]}`;
  if (TWO_WORD_TYPES.has(twoWordKey)) {
    return {
      rawType: twoWordKey,
      merchant: parts.length > 2 ? parts.slice(2).join(' ') : twoWordKey,
    };
  }

  // 기본: 첫 단어=적요, 나머지=거래처
  return {
    rawType: parts[0],
    merchant: parts.slice(1).join(' '),
  };
}

function parseKbText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];

  for (const line of lines) {
    const m = TX_RE.exec(line);
    if (!m) continue;

    const [, dateStr, time, middle, withdrawalStr, depositStr, balanceStr, memo] = m;

    const withdrawal = parseInt(withdrawalStr.replace(/,/g, ''), 10);
    const deposit    = parseInt(depositStr.replace(/,/g, ''), 10);
    const balance    = parseInt(balanceStr.replace(/,/g, ''), 10);

    if (withdrawal === 0 && deposit === 0) continue;

    const date  = dateStr.replace(/\./g, '-'); // YYYY-MM-DD
    const month = date.slice(0, 7);            // YYYY-MM

    const type   = deposit > 0 ? '입금' : '출금';
    const amount = deposit > 0 ? deposit : withdrawal;

    const { rawType, merchant } = splitTypeAndMerchant(middle);

    transactions.push({
      date,
      time,
      type,
      merchant,
      rawType,
      amount,
      balance,
      memo: memo === '-' ? '' : memo,
      month,
      livingCategory: type === '입금' ? 'income' : 'living',
    });
  }

  return transactions;
}

module.exports = { parseKbPdf };
