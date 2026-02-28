import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useFetch } from '../hooks/useFetch';
import { formatAmount, formatDate } from '../utils/format';
import { MonthSelector } from '../components/common/MonthSelector';
import { Loading, EmptyState } from '../components/common/Loading';
import api from '../utils/api';

export function TransactionsPage() {
  const { state } = useApp();
  const { selectedMonth, categories } = state;

  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);

  const { data, loading, refetch } = useFetch('/transactions', {
    month: selectedMonth,
    page,
    limit: 30,
    category: filterCategory || undefined,
    type: filterType || undefined,
    search: search || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / 30) : 1;

  const handleCategoryChange = async (txId, catId) => {
    try {
      await api.put(`/transactions/${txId}/category`, { category_id: catId });
      setEditingId(null);
      refetch();
    } catch (err) {
      alert('카테고리 변경 실패: ' + err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">거래 내역</h1>
          <p className="page-subtitle">
            {data ? `총 ${data.total.toLocaleString()}건` : ''}
          </p>
        </div>
        <MonthSelector />
      </div>

      {/* 필터 바 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 240 }}
          placeholder="거래처 또는 메모 검색..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setPage(1); }}
        >
          <option value="">전체 카테고리</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select
          className="input"
          style={{ maxWidth: 120 }}
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
        >
          <option value="">전체</option>
          <option value="입금">입금</option>
          <option value="출금">출금</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={refetch}>↻ 새로고침</button>
      </div>

      {loading ? (
        <Loading />
      ) : !data?.data?.length ? (
        <EmptyState icon="📭" title="거래 내역 없음" desc="선택된 조건에 해당하는 거래가 없습니다" />
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>시간</th>
                  <th>거래처</th>
                  <th>메모</th>
                  <th>유형</th>
                  <th>카테고리</th>
                  <th style={{ textAlign: 'right' }}>금액</th>
                  <th style={{ textAlign: 'right' }}>잔액</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatDate(tx.date)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{tx.time || '-'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.merchant || '-'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {tx.memo || '-'}
                    </td>
                    <td>
                      <span style={{
                        color: tx.type === '입금' ? 'var(--accent-green)' : 'var(--accent-red)',
                        fontSize: '0.8rem', fontWeight: 500,
                      }}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      {editingId === tx.id ? (
                        <select
                          className="input"
                          style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                          defaultValue={tx.category_id || ''}
                          onChange={e => handleCategoryChange(tx.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          autoFocus
                        >
                          <option value="">미분류</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: (tx.category_color || '#6B7280') + '22',
                            color: tx.category_color || '#6B7280',
                            cursor: 'pointer',
                            border: `1px solid ${(tx.category_color || '#6B7280')}33`,
                          }}
                          onClick={() => setEditingId(tx.id)}
                          title="클릭하여 카테고리 변경"
                        >
                          {tx.category_icon} {tx.category_name || '기타'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={tx.type === '입금' ? 'amount-income' : 'amount-expense'}>
                        {tx.type === '입금' ? '+' : '-'}{formatAmount(tx.amount)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {tx.balance > 0 ? formatAmount(tx.balance) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ◀ 이전
              </button>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                다음 ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
