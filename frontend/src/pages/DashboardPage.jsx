import { useApp } from '../context/AppContext';
import { useFetch } from '../hooks/useFetch';
import { formatAmount, formatAmountShort, formatMonth, percentChange } from '../utils/format';
import { MonthSelector } from '../components/common/MonthSelector';
import { Loading, EmptyState } from '../components/common/Loading';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

export function DashboardPage() {
  const { state } = useApp();
  const { selectedMonth } = state;

  const { data: summary, loading: summaryLoading } = useFetch('/analytics/summary', { month: selectedMonth });
  const { data: monthly } = useFetch('/analytics/monthly', { months: 6 });
  const { data: categories } = useFetch('/analytics/categories', { month: selectedMonth, type: '출금' });
  const { data: recentTx } = useFetch('/transactions', { month: selectedMonth, limit: 5 });

  if (summaryLoading) return <Loading />;

  const curr = summary?.current || {};
  const prev = summary?.prev || {};
  const expenseChange = percentChange(curr.expense, prev.expense);
  const savingsChange = percentChange(curr.savings, prev.savings);

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">부부 공동 자산 현황</p>
        </div>
        <MonthSelector />
      </div>

      {/* 요약 카드 */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <SummaryCard
          icon="🏦"
          label="총 자산"
          value={formatAmount(summary?.total_assets || 0)}
          sub="현재 잔액 기준"
          color="var(--accent-blue)"
        />
        <SummaryCard
          icon="💰"
          label="이번 달 수입"
          value={formatAmount(curr.income || 0)}
          sub={prev.income ? `지난달 대비 ${percentChange(curr.income, prev.income) > 0 ? '+' : ''}${percentChange(curr.income, prev.income)}%` : ''}
          color="var(--accent-green)"
        />
        <SummaryCard
          icon="💸"
          label="이번 달 지출"
          value={formatAmount(curr.expense || 0)}
          sub={expenseChange !== null ? `지난달 대비 ${expenseChange > 0 ? '+' : ''}${expenseChange}%` : ''}
          color="var(--accent-red)"
        />
        <SummaryCard
          icon="📈"
          label="이번 달 저축"
          value={formatAmount(curr.savings || 0)}
          sub={`저축률 ${curr.saving_rate || 0}%`}
          color="var(--accent-purple)"
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 28 }}>
        {/* 월별 수입/지출 바차트 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">월별 수입 vs 지출</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>최근 6개월</span>
          </div>
          {monthly && monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthly} barCategoryGap="30%">
                <XAxis
                  dataKey="month"
                  stroke="#64748B"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => v.slice(5)}
                />
                <YAxis
                  stroke="#64748B"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => formatAmountShort(v)}
                />
                <Tooltip
                  formatter={(v) => formatAmount(v)}
                  contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="수입" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="지출" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="📊" title="데이터 없음" desc="CSV를 업로드하면 차트가 표시됩니다" />
          )}
        </div>

        {/* 카테고리 파이차트 */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">카테고리별 지출</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatMonth(selectedMonth)}</span>
          </div>
          {categories && categories.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width="55%" height={230}>
                <PieChart>
                  <Pie
                    data={categories.slice(0, 8)}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {categories.slice(0, 8).map((entry, i) => (
                      <Cell key={i} fill={entry.color || '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatAmount(v)}
                    contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categories.slice(0, 6).map((cat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{cat.icon} {cat.name}</span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatAmountShort(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="🥧" title="데이터 없음" desc="CSV를 업로드하면 차트가 표시됩니다" />
          )}
        </div>
      </div>

      {/* 최근 거래 내역 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">최근 거래</span>
        </div>
        {recentTx?.data && recentTx.data.length > 0 ? (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>거래처</th>
                  <th>카테고리</th>
                  <th>유형</th>
                  <th style={{ textAlign: 'right' }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.data.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{tx.date}</td>
                    <td>{tx.merchant || tx.memo || '-'}</td>
                    <td>
                      {tx.category_name && (
                        <span className="badge" style={{ background: tx.category_color + '22', color: tx.category_color }}>
                          {tx.category_icon} {tx.category_name}
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: tx.type === '입금' ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.8rem' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={tx.type === '입금' ? 'amount-income' : 'amount-expense'}>
                        {tx.type === '입금' ? '+' : '-'}{formatAmount(tx.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="📭" title="거래 내역 없음" desc="이번 달 거래 데이터가 없습니다" />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color }) {
  return (
    <div className="summary-card">
      <div className="summary-card-icon">{icon}</div>
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-value" style={{ color }}>{value}</div>
      {sub && <div className="summary-card-sub">{sub}</div>}
    </div>
  );
}
