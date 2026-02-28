import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { formatAmount, formatAmountShort, formatMonth } from '../utils/format';
import { Loading, EmptyState } from '../components/common/Loading';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export function ForecastPage() {
  const [goalAmount, setGoalAmount] = useState('');
  const { data, loading } = useFetch('/analytics/forecast');

  if (loading) return <Loading />;

  if (data?.error) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">자산 예측</h1>
        </div>
        <EmptyState icon="🔮" title={data.error} desc="CSV를 2개월 이상 업로드하면 예측이 가능합니다" />
      </div>
    );
  }

  const forecast12 = data?.forecasts?.find(f => f.months === 12);
  const chartData = [
    { month: '현재', assets: data?.current_assets || 0, type: 'current' },
    ...(forecast12?.monthly_detail || []).map(d => ({
      month: d.month.slice(5) + '월',
      assets: d.projected_assets,
      saving: d.projected_saving,
      type: 'forecast',
    })),
  ];

  const goalAmountNum = parseInt(goalAmount.replace(/,/g, ''), 10);
  const goalMonth = goalAmountNum > (data?.current_assets || 0) && data?.avg_monthly_saving > 0
    ? Math.ceil((goalAmountNum - (data?.current_assets || 0)) / data?.avg_monthly_saving)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">자산 예측</h1>
        <p className="page-subtitle">현재 저축 패턴 기반 미래 자산 예측</p>
      </div>

      {/* 현재 현황 카드 */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <div className="summary-card">
          <div className="summary-card-icon">🏦</div>
          <div className="summary-card-label">현재 총 자산</div>
          <div className="summary-card-value" style={{ color: 'var(--accent-blue)', fontSize: '1.4rem' }}>
            {formatAmount(data?.current_assets || 0)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon">💰</div>
          <div className="summary-card-label">월평균 저축액</div>
          <div className="summary-card-value" style={{ color: 'var(--accent-green)', fontSize: '1.4rem' }}>
            {formatAmount(data?.avg_monthly_saving || 0)}
          </div>
          <div className="summary-card-sub">최근 {data?.history_months || 0}개월 평균</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon">📊</div>
          <div className="summary-card-label">저축률</div>
          <div className="summary-card-value" style={{ color: 'var(--accent-purple)', fontSize: '1.4rem' }}>
            {data?.saving_rate || 0}%
          </div>
          <div className="summary-card-sub">수입 대비 저축 비율</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon">📈</div>
          <div className="summary-card-label">저축 트렌드</div>
          <div className="summary-card-value" style={{
            color: (data?.trend_per_month || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
            fontSize: '1.4rem'
          }}>
            {(data?.trend_per_month || 0) >= 0 ? '+' : ''}{formatAmountShort(data?.trend_per_month || 0)}/월
          </div>
          <div className="summary-card-sub">{(data?.trend_per_month || 0) >= 0 ? '증가 추세' : '감소 추세'}</div>
        </div>
      </div>

      {/* 예측 카드 */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        {data?.forecasts?.map(forecast => (
          <div key={forecast.months} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              {forecast.months}개월 후 예측
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 4 }}>
              {formatAmountShort(forecast.projected_total)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {formatAmount(forecast.projected_total)}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              현재 대비 +{formatAmountShort(forecast.projected_total - (data?.current_assets || 0))}
            </div>
          </div>
        ))}
      </div>

      {/* 예측 차트 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">12개월 자산 예측 차트</span>
        </div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="assetsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="#64748B"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 11 }}
                tickFormatter={v => formatAmountShort(v)}
              />
              <Tooltip
                formatter={(v, name) => [formatAmount(v), name === 'assets' ? '예측 자산' : '월 저축']}
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94A3B8' }}
              />
              {goalAmountNum > 0 && (
                <ReferenceLine
                  y={goalAmountNum}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  label={{ value: '목표', fill: '#F59E0B', fontSize: 11 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="assets"
                name="assets"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#assetsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon="📈" title="데이터 부족" />
        )}
      </div>

      {/* 목표 금액 계산기 */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🎯 목표 자산 달성 예측</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
            <label className="form-label">목표 자산 금액</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="text"
                placeholder="예: 100,000,000"
                value={goalAmount}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setGoalAmount(raw ? parseInt(raw).toLocaleString() : '');
                }}
              />
            </div>
          </div>
          {goalAmountNum > 0 && (
            <div className="card" style={{ flex: 1, padding: '16px 20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              {goalAmountNum <= (data?.current_assets || 0) ? (
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>✅ 이미 달성하셨습니다!</span>
              ) : goalMonth !== null ? (
                <div>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                    약 {goalMonth}개월 후 달성 예정
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.875rem' }}>
                    (현재 저축 패턴 유지 시)
                  </span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    목표까지 {formatAmount(goalAmountNum - (data?.current_assets || 0))} 남음
                  </div>
                </div>
              ) : (
                <span style={{ color: 'var(--accent-red)' }}>저축이 없어 예측이 불가합니다</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
