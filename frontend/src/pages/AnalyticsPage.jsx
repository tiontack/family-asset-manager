import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatAmount, formatAmountShort, formatMonth } from '../utils/format';
import { MonthSelector } from '../components/common/MonthSelector';
import { Loading, EmptyState } from '../components/common/Loading';
import api from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// 커스텀 툴팁
// ─────────────────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem' }}>
      <div style={{ color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{formatMonth(label)}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color }}>
          <span>{p.name}</span>
          <strong>{formatAmount(p.value)}</strong>
        </div>
      ))}
      {payload.length >= 2 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #334155', color: '#CBD5E1', display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span>합계</span>
          <strong>{formatAmount(payload.reduce((s, p) => s + (p.value || 0), 0))}</strong>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 항목 목록 (같은 이름 묶어서 표시)
// ─────────────────────────────────────────────────────────────────────────────
function ItemList({ items, color, emptyText }) {
  // 같은 이름의 항목을 묶어서 합산
  const grouped = Object.values(
    items.reduce((acc, item) => {
      if (!acc[item.name]) acc[item.name] = { name: item.name, amount: 0, count: 0 };
      acc[item.name].amount += item.amount;
      acc[item.name].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.amount - a.amount);

  const total = grouped.reduce((s, i) => s + i.amount, 0);

  if (grouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        {emptyText}
      </div>
    );
  }
  return (
    <div>
      {grouped.map((item, idx) => {
        const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
        return (
          <div key={item.name} style={{ padding: '10px 0', borderBottom: idx < grouped.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontWeight: 500, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                {item.name}
                {item.count > 1 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 5 }}>
                    {item.count}건
                  </span>
                )}
              </span>
              <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{formatAmount(item.amount)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, marginTop: 4, borderTop: '2px solid var(--border-color)' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color }}>합계 {formatAmount(total)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { state } = useApp();
  const { selectedMonth } = state;

  const [items, setItems]     = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, monthlyRes] = await Promise.all([
        api.get('/assets/living-items', { params: { month: selectedMonth } }),
        api.get('/analytics/living-monthly', { params: { months: 12 } }),
      ]);
      setItems(itemsRes.data || []);
      setMonthly(monthlyRes.data || []);
    } catch (_) {}
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { load(); }, [load]);

  const livingItems = items.filter(i => i.category === 'living');
  const mgmtItems   = items.filter(i => i.category === 'management');
  const livingTotal = livingItems.reduce((s, i) => s + i.amount, 0);
  const mgmtTotal   = mgmtItems.reduce((s, i) => s + i.amount, 0);
  const grandTotal  = livingTotal + mgmtTotal;

  if (loading) return <Loading />;

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">지출 분석</h1>
          <p className="page-subtitle">{formatMonth(selectedMonth)} 생활비·관리비 내역</p>
        </div>
        <MonthSelector />
      </div>

      {/* ── 상단 요약 3개 카드 ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ borderTop: '3px solid var(--accent-blue)', textAlign: 'center', padding: '18px 16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>이번 달 총 지출</div>
          <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {grandTotal > 0 ? formatAmount(grandTotal) : '—'}
          </div>
        </div>
        <div className="card" style={{ borderTop: '3px solid #EF4444', textAlign: 'center', padding: '18px 16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>🛒 생활비</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#EF4444', lineHeight: 1.2 }}>
            {livingTotal > 0 ? formatAmount(livingTotal) : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>{livingItems.length}건</div>
        </div>
        <div className="card" style={{ borderTop: '3px solid #F59E0B', textAlign: 'center', padding: '18px 16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>🏠 관리비</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#F59E0B', lineHeight: 1.2 }}>
            {mgmtTotal > 0 ? formatAmount(mgmtTotal) : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>{mgmtItems.length}건</div>
        </div>
      </div>

      {/* ── 생활비·관리비 내역 ─────────────────────────────────────────── */}
      {grandTotal === 0 ? (
        <EmptyState icon="📊" title="내역 없음" desc={`${formatMonth(selectedMonth)} 지출 내역이 없습니다. 파일 업로드 탭에서 파일을 업로드해주세요.`} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* 생활비 */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 14 }}>
              <span className="card-title">🛒 생활비 내역</span>
              {livingTotal > 0 && (
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#EF4444' }}>{formatAmount(livingTotal)}</span>
              )}
            </div>
            <ItemList items={livingItems} color="#EF4444" emptyText="이번 달 생활비 내역이 없습니다" />
          </div>

          {/* 관리비 */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 14 }}>
              <span className="card-title">🏠 관리비 내역</span>
              {mgmtTotal > 0 && (
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F59E0B' }}>{formatAmount(mgmtTotal)}</span>
              )}
            </div>
            <ItemList items={mgmtItems} color="#F59E0B" emptyText="이번 달 관리비 내역이 없습니다" />
          </div>
        </div>
      )}

      {/* ── 월별 비교 그래프 ───────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 20 }}>
          <span className="card-title">📊 월별 지출 비교</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>최근 12개월</span>
        </div>
        {monthly.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} barGap={4} barCategoryGap="32%">
              <XAxis
                dataKey="month"
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                tickFormatter={v => v.slice(2).replace('-', '/')}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                tickFormatter={v => formatAmountShort(v)}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="living" name="생활비" radius={[3, 3, 0, 0]}>
                {monthly.map((entry, i) => (
                  <Cell key={i} fill={entry.month === selectedMonth ? '#EF4444' : '#EF444455'} />
                ))}
              </Bar>
              <Bar dataKey="management" name="관리비" radius={[3, 3, 0, 0]}>
                {monthly.map((entry, i) => (
                  <Cell key={i} fill={entry.month === selectedMonth ? '#F59E0B' : '#F59E0B55'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon="📉" title="데이터 없음" desc="파일 업로드 후 월별 비교 그래프가 표시됩니다" />
        )}
      </div>
    </div>
  );
}
