const { getDb } = require('../database');

/**
 * 배치 분류: 트랜잭션 배열을 한번에 분류 (DB 쿼리 최소화)
 */
function classifyBatch(transactions) {
  const db = getDb();

  // 규칙: priority DESC, 키워드 길이 DESC (더 구체적인 규칙 우선)
  const rules = db.prepare(`
    SELECT keyword, category_id, priority, LENGTH(keyword) as kw_len
    FROM rules
    ORDER BY priority DESC, kw_len DESC
  `).all();

  const incomeCategoryId = db.prepare(
    "SELECT id FROM categories WHERE name = '급여/수입'"
  ).get()?.id;

  const otherCategoryId = db.prepare(
    "SELECT id FROM categories WHERE name = '기타'"
  ).get()?.id;

  return transactions.map(tx => {
    // 입금 거래는 급여/수입으로 분류
    if (tx.type === '입금') {
      return { ...tx, category_id: incomeCategoryId };
    }

    const searchText = `${tx.merchant || ''} ${tx.memo || ''}`.toLowerCase();
    let matched = otherCategoryId;

    for (const rule of rules) {
      if (searchText.includes(rule.keyword.toLowerCase())) {
        matched = rule.category_id;
        break;
      }
    }

    return { ...tx, category_id: matched };
  });
}

/**
 * 단일 트랜잭션 분류
 */
function classifyOne(merchant, memo, type) {
  const db = getDb();

  if (type === '입금') {
    return db.prepare("SELECT id FROM categories WHERE name = '급여/수입'").get()?.id || null;
  }

  const rules = db.prepare(`
    SELECT keyword, category_id, priority, LENGTH(keyword) as kw_len
    FROM rules
    ORDER BY priority DESC, kw_len DESC
  `).all();

  const searchText = `${merchant || ''} ${memo || ''}`.toLowerCase();

  for (const rule of rules) {
    if (searchText.includes(rule.keyword.toLowerCase())) {
      return rule.category_id;
    }
  }

  return db.prepare("SELECT id FROM categories WHERE name = '기타'").get()?.id || null;
}

module.exports = { classifyBatch, classifyOne };
