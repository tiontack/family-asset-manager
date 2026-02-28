const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/analytics/monthly?months=12
router.get('/monthly', (req, res) => {
  const db = getDb();
  const { months = 12 } = req.query;

  const data = db.prepare(`
    SELECT month,
           SUM(CASE WHEN type='입금' THEN amount ELSE 0 END) as income,
           SUM(CASE WHEN type='출금' THEN amount ELSE 0 END) as expense,
           SUM(CASE WHEN type='입금' THEN amount ELSE -amount END) as savings
    FROM transactions
    GROUP BY month
    ORDER BY month DESC
    LIMIT ?
  `).all(parseInt(months));

  res.json(data.reverse());
});

// GET /api/analytics/categories?month=2024-01&type=출금
router.get('/categories', (req, res) => {
  const db = getDb();
  const { month, type = '출금' } = req.query;

  let where = `WHERE t.type = ?`;
  const params = [type];

  if (month) {
    where += ' AND t.month = ?';
    params.push(month);
  }

  const data = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.color,
      c.icon,
      c.budget,
      SUM(t.amount) as total,
      COUNT(t.id) as count,
      ROUND(SUM(t.amount) * 100.0 / (
        SELECT SUM(amount) FROM transactions t2
        WHERE t2.type = '출금' ${month ? "AND t2.month = '" + month + "'" : ''}
      ), 1) as percentage
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    ${where}
    GROUP BY t.category_id
    ORDER BY total DESC
  `).all(...params);

  res.json(data);
});

// GET /api/analytics/summary?month=2024-01
router.get('/summary', (req, res) => {
  const db = getDb();
  const { month } = req.query;

  // 이번 달 / 지난 달
  let currentMonth = month;
  if (!currentMonth) {
    const now = new Date();
    currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const [year, mon] = currentMonth.split('-').map(Number);
  const prevDate = new Date(year, mon - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const getMonthStats = db.prepare(`
    SELECT
      SUM(CASE WHEN type='입금' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type='출금' THEN amount ELSE 0 END) as expense
    FROM transactions WHERE month = ?
  `);

  const current = getMonthStats.get(currentMonth) || { income: 0, expense: 0 };
  const prev = getMonthStats.get(prevMonth) || { income: 0, expense: 0 };

  // 마지막 잔액 (총 자산)
  const lastBalance = db.prepare(`
    SELECT balance FROM transactions
    ORDER BY date DESC, time DESC, id DESC LIMIT 1
  `).get()?.balance || 0;

  // 전체 월 수
  const totalMonths = db.prepare(`
    SELECT COUNT(DISTINCT month) as cnt FROM transactions
  `).get()?.cnt || 0;

  // 평균 저축률
  const avgStats = db.prepare(`
    SELECT
      AVG(CASE WHEN type='입금' THEN amount ELSE 0 END) as avg_income,
      SUM(CASE WHEN type='입금' THEN amount ELSE -amount END) / COUNT(DISTINCT month) as avg_savings
    FROM transactions
  `).get();

  res.json({
    current_month: currentMonth,
    prev_month: prevMonth,
    current: {
      income: current.income || 0,
      expense: current.expense || 0,
      savings: (current.income || 0) - (current.expense || 0),
      saving_rate: current.income
        ? Math.round(((current.income - current.expense) / current.income) * 100)
        : 0,
    },
    prev: {
      income: prev.income || 0,
      expense: prev.expense || 0,
      savings: (prev.income || 0) - (prev.expense || 0),
    },
    total_assets: lastBalance,
    total_months: totalMonths,
    avg_monthly_savings: Math.round(avgStats?.avg_savings || 0),
  });
});

// GET /api/analytics/forecast
router.get('/forecast', (req, res) => {
  const db = getDb();

  // 최근 6개월 데이터
  const history = db.prepare(`
    SELECT month,
           SUM(CASE WHEN type='입금' THEN amount ELSE 0 END) as income,
           SUM(CASE WHEN type='출금' THEN amount ELSE 0 END) as expense
    FROM transactions
    GROUP BY month
    ORDER BY month DESC
    LIMIT 6
  `).all().reverse();

  if (history.length < 2) {
    return res.json({
      error: '예측을 위한 데이터가 부족합니다 (최소 2개월 필요)',
      history: [],
      forecasts: [],
    });
  }

  const savings = history.map(h => (h.income || 0) - (h.expense || 0));
  const avgSaving = savings.reduce((a, b) => a + b, 0) / savings.length;
  const avgIncome = history.reduce((a, b) => a + (b.income || 0), 0) / history.length;

  // 선형 회귀 (최소제곱법)
  const n = savings.length;
  const xMean = (n - 1) / 2;
  const yMean = avgSaving;
  let num = 0, den = 0;
  savings.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;

  // 현재 총 자산
  const lastBalance = db.prepare(`
    SELECT balance FROM transactions
    ORDER BY date DESC, time DESC, id DESC LIMIT 1
  `).get()?.balance || 0;

  const lastMonth = history[history.length - 1].month;

  const buildForecast = (months) => {
    let totalAssets = lastBalance;
    const monthlyDetail = [];

    for (let i = 1; i <= months; i++) {
      const projectedSaving = avgSaving + slope * i;
      totalAssets += Math.max(projectedSaving, 0);

      const [y, m] = lastMonth.split('-').map(Number);
      const futureDate = new Date(y, m - 1 + i, 1);
      const futureMonth = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

      monthlyDetail.push({
        month: futureMonth,
        projected_saving: Math.round(Math.max(projectedSaving, 0)),
        projected_assets: Math.round(totalAssets),
      });
    }

    return {
      period: `${months}개월`,
      months,
      projected_total: Math.round(totalAssets),
      monthly_detail: monthlyDetail,
    };
  };

  const savingRate = avgIncome > 0 ? Math.round((avgSaving / avgIncome) * 100) : 0;

  res.json({
    current_assets: lastBalance,
    avg_monthly_saving: Math.round(avgSaving),
    avg_monthly_income: Math.round(avgIncome),
    saving_rate: savingRate,
    trend_per_month: Math.round(slope),
    history_months: history.length,
    forecasts: [
      buildForecast(6),
      buildForecast(12),
      buildForecast(36),
    ],
  });
});

// GET /api/analytics/trend?months=12 - 카테고리별 트렌드
router.get('/trend', (req, res) => {
  const db = getDb();
  const { months = 6 } = req.query;

  const data = db.prepare(`
    SELECT t.month, c.name as category, c.color, SUM(t.amount) as total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.type = '출금'
    AND t.month IN (
      SELECT DISTINCT month FROM transactions ORDER BY month DESC LIMIT ?
    )
    GROUP BY t.month, t.category_id
    ORDER BY t.month ASC
  `).all(parseInt(months));

  res.json(data);
});

module.exports = router;
