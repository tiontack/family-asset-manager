import { useApp } from '../context/AppContext';
import { useFetch } from '../hooks/useFetch';
import { formatAmount, formatAmountShort, formatMonth } from '../utils/format';
import { MonthSelector } from '../components/common/MonthSelector';
import { Loading, EmptyState } from '../components/common/Loading';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

export function AnalyticsPage() {
  const { state } = useApp();
  const { selectedMonth } = state;

  const { data: categories, loading } = useFetch('/analytics/categories', { month: selectedMonth, type: '출금' });
  const { data: monthly } = useFetch('/analytics/monthly', { months: 12 });

  const totalExpense = categories?.reduce((s, c) => s + (c.total || 0), 0) || 0;

  if (loading) return <Loading />;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">지출 분석</h1>
          <p className="page-subtitle">카테고리별 지출 현황 및 트렌드</p>
        </div>
        <MonthSelector />
      </div>

      {/* 카테고리별 지출 현황 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">카테고리별 지출 현황</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            총 지출: <strong style={{ color: 'var(--text-primary)' }}>{formatAmount(totalExpense)}</strong>
          </span>
        </div>

        {categories && categories.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {categories.map(cat => {
              const pct = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0;
              const overBudget = cat.budget > 0 && cat.total > cat.budget;
              return (
                <div key={cat.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.count}건</span>
                      {overBudget && (
                        <span style={{ fontSize: '0.72rem', background: '#EF444422', color: '#EF4444', padding: '1px 6px', borderRadius: 4 }}>
                          예산 초과
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, color: cat.color }}>{formatAmount(cat.total)}</span>
                      {cat.budget > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                          / {formatAmount(cat.budget)}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>({pct}%)</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(cat.budget > 0 ? (cat.total / cat.budget) * 100 : pct, 100)}%`,
                        background: overBudget ? 'var(--accent-red)' : cat.color,
                      }}
                    />
                  </div>
                  {cat.budget > 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      예산 {cat.budget > 0 ? Math.round((cat.total / cat.budget) * 100) : 0}% 사용
                      {cat.budget > cat.total && (
                        <span style={{ color: 'var(--accent-green)', marginLeft: 6 }}>
                          ({formatAmountShort(cat.budget - cat.total)} 남음)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="📊" title="데이터 없음" desc="이번 달 지출 데이터가 없습니다" />
        )}
      </div>

      {/* 월별 트렌드 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">월별 수입/지출 트렌드</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>최근 12개월</span>
        </div>
        {monthly && monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <XAxis
                dataKey="month"
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                tickFormatter={v => v.slice(5) + '월'}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                tickFormatter={v => formatAmountShort(v)}
              />
              <Tooltip
                formatter={v => formatAmount(v)}
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94A3B8' }}
                labelFormatter={v => formatMonth(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="income" name="수입" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" name="지출" stroke="#EF4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="savings" name="저축" stroke="#6366F1" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon="📉" title="데이터 없음" desc="CSV를 업로드하면 트렌드가 표시됩니다" />
        )}
      </div>

      {/* 카테고리별 막대차트 */}
      {categories && categories.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">카테고리별 지출 비교</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categories} layout="vertical" barSize={18}>
              <XAxis
                type="number"
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                tickFormatter={v => formatAmountShort(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={80}
                stroke="#64748B"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={v => formatAmount(v)}
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
              />
              <Bar dataKey="total" name="지출액" radius={[0, 4, 4, 0]}>
                {categories.map((entry, i) => (
                  <Cell key={i} fill={entry.color || '#6B7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

