import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatAmount, formatAmountShort, formatMonth, getCurrentMonth, addMonths } from '../utils/format';
import { MonthSelector } from '../components/common/MonthSelector';
import api from '../utils/api';

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
function calcMonthDiff(startYM, endYM) {
  const [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
}
// refMonth: 기준 월 (YYYY-MM). 해당 월까지 납입한 개월 수를 반환
function calcPaidMonths(startYM, endYM, refMonth) {
  const ref = refMonth || getCurrentMonth();
  const [sy, sm] = startYM.split('-').map(Number);
  const [ry, rm] = ref.split('-').map(Number);
  const total = calcMonthDiff(startYM, endYM);
  const paid = (ry - sy) * 12 + (rm - sm) + 1;
  return Math.min(Math.max(0, paid), total);
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { state } = useApp();
  const { selectedMonth } = state;

  const [realestate, setRealestate] = useState([]);
  const [savings, setSavings] = useState([]);
  const [livingItems, setLivingItems] = useState([]);

  // 모달 상태
  const [reModal, setReModal] = useState(null);
  const [svModal, setSvModal] = useState(null);
  const [itemModal, setItemModal] = useState(null); // null | { category } | item(수정)
  const [csvModal, setCsvModal] = useState(null);   // null | 'living' | 'management'

  // 활성 탭: 'living' | 'management'
  const [activeTab, setActiveTab] = useState('living');

  // ── 로드 ─────────────────────────────────────────────────────────────────
  const loadRealestate = useCallback(async () => {
    const res = await api.get('/assets/realestate');
    setRealestate(res.data);
  }, []);
  const loadSavings = useCallback(async () => {
    const res = await api.get('/assets/savings');
    setSavings(res.data);
  }, []);
  const loadLivingItems = useCallback(async (month) => {
    const res = await api.get(`/assets/living-items?month=${month}`);
    setLivingItems(res.data);
  }, []);

  useEffect(() => { loadRealestate(); loadSavings(); }, [loadRealestate, loadSavings]);
  useEffect(() => { loadLivingItems(selectedMonth); }, [selectedMonth, loadLivingItems]);

  // ── 합계 ─────────────────────────────────────────────────────────────────
  const totalRealestate = realestate.reduce((s, r) => s + r.value, 0);
  // 선택 월 기준으로 해당 월까지 납입한 금액만 합산
  const totalSavings = savings.reduce((s, sv) => s + sv.monthly_amount * calcPaidMonths(sv.start_date, sv.end_date, selectedMonth), 0);
  const totalAssets = totalRealestate + totalSavings;

  const livingExp = livingItems.filter(i => i.category === 'living').reduce((s, i) => s + i.amount, 0);
  const mgmtExp   = livingItems.filter(i => i.category === 'management').reduce((s, i) => s + i.amount, 0);
  const activeItems = livingItems.filter(i => i.category === activeTab);

  // ── 반복항목 이전 달에서 복사 ───────────────────────────────────────────
  const handleCopyRecurring = async () => {
    const fromMonth = addMonths(selectedMonth, -1);
    const res = await api.post('/assets/living-items/copy-recurring', {
      from_month: fromMonth, to_month: selectedMonth,
    });
    if (res.data.copied > 0) {
      await loadLivingItems(selectedMonth);
      alert(`지난 달 반복항목 ${res.data.copied}건을 복사했습니다.`);
    } else {
      alert('복사할 반복항목이 없거나 이미 복사된 항목입니다.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* 헤더 */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 className="page-title">대시보드</h1>
          <p className="page-subtitle">부부 공동 자산 현황</p>
        </div>
      </div>

      {/* ══════════════════════ 총 자산 ══════════════════════ */}
      <SectionHeader icon="🏦" title="총 자산" total={totalAssets} color="var(--accent-blue)" />
      <div className="grid-2" style={{ marginBottom: 36 }}>
        {/* 부동산 */}
        <AssetCard icon="🏠" title="부동산" total={totalRealestate} color="#F59E0B" onAdd={() => setReModal('add')}>
          {realestate.length === 0 ? <EmptyRow text="등록된 부동산이 없습니다" /> :
            realestate.map(r => (
              <AssetRow key={r.id} name={r.name} value={r.value} sub={r.note}
                onEdit={() => setReModal(r)}
                onDelete={async () => {
                  if (!window.confirm(`'${r.name}'을 삭제할까요?`)) return;
                  try {
                    await api.delete(`/assets/realestate/${r.id}`);
                    setRealestate(prev => prev.filter(x => x.id !== r.id));
                  } catch (err) { alert('삭제 실패: ' + (err.response?.data?.error || err.message)); }
                }} />
            ))}
        </AssetCard>

        {/* 적금/저금 */}
        <AssetCard icon="💳" title="적금 / 저금"
          total={savings.reduce((s, sv) => s + sv.monthly_amount * calcPaidMonths(sv.start_date, sv.end_date, selectedMonth), 0)}
          totalLabel={`${formatMonth(selectedMonth)} 납입액`} color="#6366F1" onAdd={() => setSvModal('add')}>
          {savings.length === 0 ? <EmptyRow text="등록된 적금이 없습니다" /> :
            savings.map(sv => {
              const total  = sv.monthly_amount * calcMonthDiff(sv.start_date, sv.end_date);
              const paid   = sv.monthly_amount * calcPaidMonths(sv.start_date, sv.end_date, selectedMonth);
              const months = calcMonthDiff(sv.start_date, sv.end_date);
              return (
                <AssetRow key={sv.id} name={sv.name} value={paid}
                  sub={`월 ${formatAmountShort(sv.monthly_amount)} × ${calcPaidMonths(sv.start_date, sv.end_date, selectedMonth)}개월 납입 | 만기 ${formatAmountShort(total)} (${months}개월)`}
                  progress={total > 0 ? Math.round((paid / total) * 100) : 0}
                  onEdit={() => setSvModal(sv)}
                  onDelete={async () => {
                    if (!window.confirm(`'${sv.name}'을 삭제할까요?`)) return;
                    try {
                      await api.delete(`/assets/savings/${sv.id}`);
                      setSavings(prev => prev.filter(x => x.id !== sv.id));
                    } catch (err) { alert('삭제 실패: ' + (err.response?.data?.error || err.message)); }
                  }} />
              );
            })}
        </AssetCard>
      </div>

      {/* ══════════════════════ 생활비 섹션 ══════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionHeader icon="🧾" title="생활비" total={livingExp + mgmtExp} color="var(--accent-red)" inline />
        <MonthSelector />
      </div>

      {/* 요약 카드 2개 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <LivingSummaryCard icon="🛒" title="월 생활비" value={livingExp} color="#EF4444"
          active={activeTab === 'living'} onClick={() => setActiveTab('living')} />
        <LivingSummaryCard icon="🏢" title="월 관리비" value={mgmtExp} color="#F59E0B"
          active={activeTab === 'management'} onClick={() => setActiveTab('management')} />
      </div>

      {/* 내역 카드 */}
      <div className="card" style={{ marginBottom: 36 }}>
        {/* 카드 헤더: 탭 + 버튼들 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 0, background: 'var(--bg-tertiary)', borderRadius: 10, padding: 4 }}>
            {[['living', '🛒 생활비'], ['management', '🏢 관리비']].map(([val, label]) => (
              <button key={val} onClick={() => setActiveTab(val)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                background: activeTab === val ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === val ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SmallBtn label="반복항목 가져오기 ↺" color="var(--accent-purple)" onClick={handleCopyRecurring} />
            <SmallBtn label="파일 업로드" color="var(--accent-green)" onClick={() => setCsvModal(activeTab)} />
            <SmallBtn label="+ 항목 추가" color="var(--accent-blue)" onClick={() => setItemModal({ category: activeTab })} />
          </div>
        </div>

        {/* 내역 테이블 */}
        {activeItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: '0.9rem' }}>내역이 없습니다. + 항목 추가 또는 파일 업로드로 등록하세요.</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>항목명</th>
                  <th style={{ textAlign: 'right' }}>금액</th>
                  <th style={{ textAlign: 'center' }}>반복</th>
                  <th>메모</th>
                  <th style={{ textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: activeTab === 'living' ? '#EF4444' : '#F59E0B' }}>
                      {formatAmount(item.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.is_recurring ? (
                        <span style={{ background: 'var(--accent-purple)22', color: 'var(--accent-purple)', borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          매월
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>단건</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.note || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <ActionBtn label="수정" color="var(--accent-blue)" onClick={() => setItemModal(item)} />
                        <ActionBtn label="삭제" color="var(--accent-red)" onClick={async () => {
                          if (!window.confirm(`'${item.name}'을 삭제할까요?`)) return;
                          try {
                            await api.delete(`/assets/living-items/${item.id}`);
                            setLivingItems(prev => prev.filter(x => x.id !== item.id));
                          } catch (err) { alert('삭제 실패: ' + (err.response?.data?.error || err.message)); }
                        }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700, paddingTop: 12 }}>합계</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', paddingTop: 12,
                    color: activeTab === 'living' ? '#EF4444' : '#F59E0B' }}>
                    {formatAmount(activeItems.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════ 모달 ══════════════════════ */}
      {reModal !== null && (
        <RealEstateModal
          key={reModal === 'add' ? 're-new' : reModal.id}
          item={reModal === 'add' ? null : reModal}
          onClose={() => setReModal(null)}
          onSave={async (data) => {
            try {
              if (reModal === 'add') {
                const { data: created } = await api.post('/assets/realestate', data);
                setRealestate(prev => [created, ...prev]);
              } else {
                const { data: updated } = await api.put(`/assets/realestate/${reModal.id}`, data);
                setRealestate(prev => prev.map(r => r.id === updated.id ? updated : r));
              }
              setReModal(null);
            } catch (err) {
              alert('저장 실패: ' + (err.response?.data?.error || err.message));
            }
          }} />
      )}
      {svModal !== null && (
        <SavingsModal
          key={svModal === 'add' ? 'sv-new' : svModal.id}
          item={svModal === 'add' ? null : svModal}
          onClose={() => setSvModal(null)}
          onSave={async (data) => {
            try {
              if (svModal === 'add') {
                const { data: created } = await api.post('/assets/savings', data);
                setSavings(prev => [created, ...prev]);
              } else {
                const { data: updated } = await api.put(`/assets/savings/${svModal.id}`, data);
                setSavings(prev => prev.map(s => s.id === updated.id ? updated : s));
              }
              setSvModal(null);
            } catch (err) {
              alert('저장 실패: ' + (err.response?.data?.error || err.message));
            }
          }} />
      )}
      {itemModal !== null && (
        <LivingItemModal
          key={itemModal.id || 'item-new'}
          item={'category' in itemModal && !('id' in itemModal) ? null : itemModal}
          defaultCategory={itemModal.category || activeTab}
          month={selectedMonth}
          onClose={() => setItemModal(null)}
          onSave={async (data) => {
            try {
              if (itemModal.id) {
                const { data: updated } = await api.put(`/assets/living-items/${itemModal.id}`, data);
                setLivingItems(prev => prev.map(i => i.id === updated.id ? updated : i));
              } else {
                const { data: created } = await api.post('/assets/living-items', data);
                if (created.month === selectedMonth) {
                  setLivingItems(prev => [created, ...prev]);
                }
              }
              setItemModal(null);
            } catch (err) {
              alert('저장 실패: ' + (err.response?.data?.error || err.message));
            }
          }} />
      )}
      {csvModal !== null && (
        <CsvUploadModal
          category={csvModal}
          month={selectedMonth}
          onClose={() => setCsvModal(null)}
          onDone={async () => { await loadLivingItems(selectedMonth); setCsvModal(null); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 UI 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, total, color, inline }) {
  const el = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{formatAmount(total)}</div>
      </div>
    </div>
  );
  return inline ? el : <div style={{ marginBottom: 16 }}>{el}</div>;
}

function AssetCard({ icon, title, total, totalLabel = '합계', color, onAdd, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{icon} {title}</span>
        <button onClick={onAdd} style={{ background: color+'22', color, border: `1px solid ${color}44`, borderRadius: 8, padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
          + 등록
        </button>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{totalLabel}</span>
        <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{formatAmount(total)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function AssetRow({ name, value, sub, progress, onEdit, onDelete }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>{name}</div>
          {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sub}</div>}
          {progress !== undefined && (
            <div style={{ marginTop: 6 }}>
              <div style={{ height: 5, background: 'var(--border-color)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: 'var(--accent-purple)', borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{progress}% 납입</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginLeft: 12, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{formatAmount(value)}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <ActionBtn label="수정" onClick={onEdit} color="var(--accent-blue)" />
            <ActionBtn label="삭제" onClick={onDelete} color="var(--accent-red)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LivingSummaryCard({ icon, title, value, color, active, onClick }) {
  return (
    <div className="card" onClick={onClick} style={{
      cursor: 'pointer', border: active ? `2px solid ${color}` : '2px solid transparent',
      transition: 'border 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '1.3rem' }}>{icon}</span>
        {active && <span style={{ fontSize: '0.7rem', background: color+'22', color, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>선택됨</span>}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{formatAmount(value)}</div>
    </div>
  );
}

function ActionBtn({ label, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background: color+'18', color, border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function SmallBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: color+'18', color, border: `1px solid ${color}44`, borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  );
}

function EmptyRow({ text }) {
  return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{text}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달 공통 래퍼
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, onSubmit, children, wide }) {
  const [submitting, setSubmitting] = useState(false);
  const wrappedSubmit = async (e) => {
    if (submitting) return;
    setSubmitting(true);
    try { await onSubmit(e); } finally { setSubmitting(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: wide ? 560 : 440, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>
        <form onSubmit={wrappedSubmit}>
          {children}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>취소</button>
            <button type="submit" disabled={submitting} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: submitting ? 'var(--accent-purple)' : 'var(--accent-blue)', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: submitting ? 0.85 : 1 }}>
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children, half }) {
  return (
    <div style={{ marginBottom: 14, flex: half ? 1 : undefined }}>
      <label style={{ display: 'block', fontSize: '0.83rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.95rem', boxSizing: 'border-box' };
const selectStyle = { ...inputStyle };

// 숫자 raw → 콤마 표시
const toComma = (raw) => raw ? Number(raw).toLocaleString('ko-KR') : '';
// 입력값 → raw (숫자만)
const toRaw = (v) => v.replace(/[^0-9]/g, '');

// ─────────────────────────────────────────────────────────────────────────────
// 부동산 모달
// ─────────────────────────────────────────────────────────────────────────────
function RealEstateModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [value, setValue] = useState(item?.value ? String(item.value) : '');
  const [note, setNote] = useState(item?.note || '');
  const handleSubmit = async (e) => { e.preventDefault(); if (!name || !value) return; await onSave({ name: name.trim(), value: Number(value), note }); };
  return (
    <Modal title={item ? '부동산 수정' : '부동산 등록'} onClose={onClose} onSubmit={handleSubmit}>
      <FormField label="이름"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="예: 강남 아파트" required /></FormField>
      <FormField label="현재 가치 (원)">
        <input style={inputStyle} inputMode="numeric" value={toComma(value)} onChange={e => setValue(toRaw(e.target.value))} placeholder="0" required />
      </FormField>
      <FormField label="메모 (선택)"><input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="메모" /></FormField>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 적금 모달
// ─────────────────────────────────────────────────────────────────────────────
function SavingsModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [monthly, setMonthly] = useState(item?.monthly_amount ? String(item.monthly_amount) : '');
  const [startDate, setStartDate] = useState(item?.start_date || getCurrentMonth());
  const [endDate, setEndDate] = useState(item?.end_date || '');
  const [note, setNote] = useState(item?.note || '');
  const months = startDate && endDate ? calcMonthDiff(startDate, endDate) : 0;
  const expected = months > 0 && monthly ? Number(monthly) * months : 0;
  const handleSubmit = async (e) => { e.preventDefault(); if (!name || !monthly || !startDate || !endDate) return; await onSave({ name: name.trim(), monthly_amount: Number(monthly), start_date: startDate, end_date: endDate, note }); };
  return (
    <Modal title={item ? '적금 수정' : '적금 / 저금 등록'} onClose={onClose} onSubmit={handleSubmit}>
      <FormField label="이름"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="예: 청년 적금" required /></FormField>
      <FormField label="월 납입액 (원)">
        <input style={inputStyle} inputMode="numeric" value={toComma(monthly)} onChange={e => setMonthly(toRaw(e.target.value))} placeholder="0" required />
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="시작 월"><input style={inputStyle} type="month" value={startDate} onChange={e => setStartDate(e.target.value)} required /></FormField>
        <FormField label="종료 월"><input style={inputStyle} type="month" value={endDate} onChange={e => setEndDate(e.target.value)} required /></FormField>
      </div>
      {expected > 0 && (
        <div style={{ background: 'var(--accent-purple)18', border: '1px solid var(--accent-purple)44', borderRadius: 10, padding: '12px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{months}개월 납입 → 만기 예상액</span>
          <span style={{ fontWeight: 700, color: 'var(--accent-purple)', fontSize: '1rem' }}>{formatAmount(expected)}</span>
        </div>
      )}
      <FormField label="메모 (선택)"><input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="메모" /></FormField>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 생활비 항목 등록/수정 모달
// ─────────────────────────────────────────────────────────────────────────────
function LivingItemModal({ item, defaultCategory, month, onClose, onSave }) {
  const [category, setCategory] = useState(item?.category || defaultCategory || 'living');
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(item?.amount ? String(item.amount) : '');
  const [isRecurring, setIsRecurring] = useState(item?.is_recurring ? true : false);
  const [note, setNote] = useState(item?.note || '');
  const [itemMonth, setItemMonth] = useState(item?.month || month);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !amount) return;
    await onSave({ category, name: name.trim(), amount: Number(amount), month: itemMonth, is_recurring: isRecurring, note });
  };

  return (
    <Modal title={item ? '항목 수정' : '항목 추가'} onClose={onClose} onSubmit={handleSubmit}>
      {/* 구분 선택 */}
      <FormField label="구분">
        <div style={{ display: 'flex', gap: 8 }}>
          {[['living', '🛒 생활비'], ['management', '🏢 관리비']].map(([val, label]) => (
            <button key={val} type="button" onClick={() => setCategory(val)} style={{
              flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${category === val ? (val === 'living' ? '#EF4444' : '#F59E0B') : 'var(--border-color)'}`,
              background: category === val ? (val === 'living' ? '#EF444418' : '#F59E0B18') : 'var(--bg-tertiary)',
              color: category === val ? (val === 'living' ? '#EF4444' : '#F59E0B') : 'var(--text-muted)',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </FormField>

      <FormField label="항목명">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="예: 전기요금, 식비" required />
      </FormField>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="금액 (원)">
          <input style={inputStyle} inputMode="numeric" value={toComma(amount)} onChange={e => setAmount(toRaw(e.target.value))} placeholder="0" required />
        </FormField>
        <FormField label="해당 월">
          <input style={inputStyle} type="month" value={itemMonth} onChange={e => setItemMonth(e.target.value)} required />
        </FormField>
      </div>

      {/* 반복 여부 — 토글 */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={() => setIsRecurring(v => !v)} style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: isRecurring ? 'var(--accent-purple)' : 'var(--border-color)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute', top: 2, left: isRecurring ? 22 : 2,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>매월 반복 항목</div>
          <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>활성화하면 다음 달에 자동으로 가져올 수 있습니다</div>
        </div>
        {isRecurring && (
          <span style={{ marginLeft: 'auto', background: 'var(--accent-purple)22', color: 'var(--accent-purple)', borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>매월</span>
        )}
      </div>

      <FormField label="메모 (선택)">
        <input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="메모" />
      </FormField>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 파일 업로드 모달 (CSV / XLSX / HTML 통합)
// ─────────────────────────────────────────────────────────────────────────────
function CsvUploadModal({ category, month, onClose, onDone }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const catLabel = category === 'living' ? '생활비' : '관리비';
  const catColor = category === 'living' ? '#EF4444' : '#F59E0B';

  // 파일 확장자로 자동 카테고리 결정
  const fileExt = file?.name.split('.').pop().toLowerCase() || '';
  const autoCategory = (fileExt === 'html' || fileExt === 'htm') ? 'management' : 'living';
  const effectiveCat = (fileExt === 'html' || fileExt === 'htm' || fileExt === 'xlsx') ? autoCategory : category;
  const effectiveColor = effectiveCat === 'management' ? '#F59E0B' : '#EF4444';
  const effectiveLabel = effectiveCat === 'management' ? '관리비' : '생활비';

  const handleFile = e => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); setError(''); }
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!file) return;
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('month', month);
      fd.append('category', effectiveCat);
      const res = await api.post('/assets/living-items/upload-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || '파일 업로드에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fileIcon = (fileExt === 'html' || fileExt === 'htm') ? '🏦'
    : fileExt === 'xlsx' ? '🟩' : '📄';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{catLabel} 파일 업로드</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* 지원 형식 안내 */}
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14, marginBottom: 18, fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>📋 지원 파일 형식</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#10B98118', color: '#10B981', borderRadius: 5, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 700 }}>생활비</span>
              <span style={{ color: 'var(--text-secondary)' }}>토스뱅크 거래내역 — <strong>.xlsx</strong> (비밀번호 자동) · <strong>.csv</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: '#F59E0B18', color: '#F59E0B', borderRadius: 5, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 700 }}>관리비</span>
              <span style={{ color: 'var(--text-secondary)' }}>우리은행 보안메일 — <strong>.html</strong> (비밀번호 자동)</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpload}>
          {/* 드래그 영역 */}
          <div
            style={{ border: `2px dashed ${file ? effectiveColor : 'var(--border-color)'}`, borderRadius: 12, padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'border 0.2s', background: file ? effectiveColor+'08' : 'transparent' }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setResult(null); setError(''); } }}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.html,.htm" style={{ display: 'none' }} onChange={handleFile} />
            {file ? (
              <div>
                <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{fileIcon}</div>
                <div style={{ fontWeight: 700, color: effectiveColor }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB &nbsp;·&nbsp;
                  <span style={{ background: effectiveColor+'18', color: effectiveColor, borderRadius: 5, padding: '1px 6px', fontWeight: 700 }}>{effectiveLabel}로 반영</span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📤</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>파일을 드래그하거나 클릭해서 선택</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>.csv · .xlsx · .html (최대 20MB)</div>
              </div>
            )}
          </div>

          {error && <div style={{ background: 'var(--accent-red)18', border: '1px solid var(--accent-red)44', borderRadius: 8, padding: 12, color: 'var(--accent-red)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}

          {result && (
            <div style={{ background: 'var(--accent-green)18', border: '1px solid var(--accent-green)44', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-green)', marginBottom: 6 }}>✅ 업로드 완료</div>
              <div style={{ fontSize: '0.85rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>등록: <b style={{ color: 'var(--accent-green)' }}>{result.inserted}건</b></span>
                <span>생략: <b style={{ color: 'var(--text-muted)' }}>{result.skipped}건</b></span>
              </div>
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--accent-red)' }}>
                  오류: {result.errors.join(', ')}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {result ? (
              <button type="button" onClick={onDone} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: effectiveColor, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>완료</button>
            ) : (
              <>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}>취소</button>
                <button type="submit" disabled={!file || loading} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: file && !loading ? effectiveColor : 'var(--border-color)', color: '#fff', cursor: file && !loading ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                  {loading ? '처리 중...' : '업로드'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
