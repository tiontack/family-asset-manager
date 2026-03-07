import { useState, useEffect, useCallback } from 'react';
import { formatAmount, formatAmountShort, formatMonth, getCurrentMonth, addMonths } from '../utils/format';
import api from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
function calcMonthDiff(startYM, endYM) {
  const [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
}
function calcPaidMonths(startYM, endYM, refMonth) {
  const ref = refMonth || getCurrentMonth();
  const [sy, sm] = startYM.split('-').map(Number);
  const [ry, rm] = ref.split('-').map(Number);
  const total = calcMonthDiff(startYM, endYM);
  const paid = (ry - sy) * 12 + (rm - sm) + 1;
  return Math.min(Math.max(0, paid), total);
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN 게이트
// ─────────────────────────────────────────────────────────────────────────────
function PinGate({ onSuccess }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  const handleKey = useCallback((digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      if (next === '0403') {
        sessionStorage.setItem('sean_auth', '1');
        onSuccess();
      } else {
        setShake(true); setError(true);
        setTimeout(() => { setPin(''); setShake(false); setError(false); }, 700);
      }
    }
  }, [pin, onSuccess]);

  const handleDel = () => setPin(p => p.slice(0, -1));

  const keyPad = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-primary)', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 24, padding: '48px 40px', maxWidth: 340, width: '100%', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          Sean 개인 자산
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 32 }}>
          비밀번호를 입력하세요
        </p>

        {/* PIN 도트 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 36,
          animation: shake ? 'shake 0.4s ease' : 'none',
        }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: '50%',
              background: i < pin.length ? (error ? '#EF4444' : 'var(--accent-blue)') : 'var(--bg-tertiary)',
              border: `2px solid ${i < pin.length ? (error ? '#EF4444' : 'var(--accent-blue)') : 'var(--border-color)'}`,
              transition: 'all 0.15s',
            }} />
          ))}
        </div>
        {error && (
          <p style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: 16, marginTop: -24 }}>
            비밀번호가 틀렸습니다
          </p>
        )}

        {/* 숫자 패드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {keyPad.map((k, i) => (
            k === null
              ? <div key={i} />
              : (
                <button
                  key={i}
                  onClick={() => k === '⌫' ? handleDel() : handleKey(String(k))}
                  style={{
                    height: 60, fontSize: k === '⌫' ? '1.2rem' : '1.35rem', fontWeight: 600,
                    background: k === '⌫' ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 14, cursor: 'pointer',
                    color: 'var(--text-primary)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-blue)22'}
                  onMouseLeave={e => e.currentTarget.style.background = k === '⌫' ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}
                >
                  {k}
                </button>
              )
          ))}
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-8px); }
          40%,80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 로컬 월 선택기
// ─────────────────────────────────────────────────────────────────────────────
function LocalMonthSelector({ value, onChange }) {
  const go = (d) => onChange(addMonths(value, d));
  return (
    <div className="month-selector">
      <button className="month-btn" onClick={() => go(-1)}>◀</button>
      <span className="month-display">{formatMonth(value)}</span>
      <button className="month-btn" onClick={() => go(1)}>▶</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 UI 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)',
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input {...props} style={{
      width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-color)', borderRadius: 10, color: 'var(--text-primary)',
      fontSize: '0.95rem', boxSizing: 'border-box', ...props.style,
    }} />
  );
}

function SaveBtn({ onClick, label = '저장' }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '12px', background: 'var(--accent-blue)', color: '#fff',
      border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', marginTop: 8,
    }}>{label}</button>
  );
}

function Btn({ label, color, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '4px 10px' : '7px 14px', background: color + '22', color,
      border: `1px solid ${color}44`, borderRadius: 8, fontSize: small ? '0.75rem' : '0.82rem',
      fontWeight: 600, cursor: 'pointer',
    }}>{label}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달: 부동산
// ─────────────────────────────────────────────────────────────────────────────
function RealEstateModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [value, setValue] = useState(item?.value ?? '');
  const [note, setNote] = useState(item?.note || '');
  return (
    <Modal title={item ? '부동산 수정' : '부동산 등록'} onClose={onClose}>
      <Field label="이름"><Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 강남 오피스텔" /></Field>
      <Field label="현재 가치 (원)"><Input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="예: 300000000" /></Field>
      <Field label="메모"><Input value={note} onChange={e => setNote(e.target.value)} placeholder="선택 입력" /></Field>
      <SaveBtn onClick={() => onSave({ name, value: Number(value), note })} />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달: 적금
// ─────────────────────────────────────────────────────────────────────────────
function SavingsModal({ item, month, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [monthly, setMonthly] = useState(item?.monthly_amount ?? '');
  const [start, setStart] = useState(item?.start_date || month);
  const [end, setEnd] = useState(item?.end_date || month);
  const [note, setNote] = useState(item?.note || '');
  const totalMonths = start && end ? calcMonthDiff(start, end) : 0;
  const expected = Number(monthly) * totalMonths;
  return (
    <Modal title={item ? '적금 수정' : '적금 등록'} onClose={onClose}>
      <Field label="이름"><Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 청년 적금" /></Field>
      <Field label="월 납입액 (원)"><Input type="number" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="예: 300000" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="시작 월"><Input type="month" value={start} onChange={e => setStart(e.target.value)} /></Field>
        <Field label="종료 월"><Input type="month" value={end} onChange={e => setEnd(e.target.value)} /></Field>
      </div>
      {totalMonths > 0 && (
        <div style={{ padding: '10px 14px', background: 'var(--accent-blue)11', borderRadius: 10, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
          납입기간 {totalMonths}개월 · 만기 예상 <strong style={{ color: 'var(--accent-blue)' }}>{formatAmount(expected)}</strong>
        </div>
      )}
      <Field label="메모"><Input value={note} onChange={e => setNote(e.target.value)} placeholder="선택 입력" /></Field>
      <SaveBtn onClick={() => onSave({ name, monthly_amount: Number(monthly), start_date: start, end_date: end, note })} />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달: 지출 항목 추가/수정
// ─────────────────────────────────────────────────────────────────────────────
function LivingItemModal({ item, defaultCategory, defaultMonth, onClose, onSave }) {
  const [category, setCategory] = useState(item?.category || defaultCategory || 'living');
  const [name, setName] = useState(item?.name || '');
  const [amount, setAmount] = useState(item?.amount ?? '');
  const [month, setMonth] = useState(item?.month || defaultMonth);
  const [note, setNote] = useState(item?.note || '');
  const [recurring, setRecurring] = useState(item?.is_recurring ? true : false);
  return (
    <Modal title={item ? '항목 수정' : '항목 추가'} onClose={onClose}>
      <Field label="분류">
        <div style={{ display: 'flex', gap: 8 }}>
          {[['living', '🛒 생활비'], ['management', '🏢 관리비']].map(([v, l]) => (
            <button key={v} onClick={() => setCategory(v)} style={{
              flex: 1, padding: '8px', borderRadius: 10, border: '1px solid var(--border-color)',
              background: category === v ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: category === v ? '#fff' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="항목명"><Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 쿠팡" /></Field>
      <Field label="금액 (원)"><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <Field label="월"><Input type="month" value={month} onChange={e => setMonth(e.target.value)} /></Field>
      <Field label="메모"><Input value={note} onChange={e => setNote(e.target.value)} placeholder="선택 입력" /></Field>
      <Field label="반복">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
          <span style={{ fontSize: '0.9rem' }}>매월 반복 항목</span>
        </label>
      </Field>
      <SaveBtn onClick={() => onSave({ category, name, amount: Number(amount), month, note, is_recurring: recurring })} />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 모달: 파일 업로드
// ─────────────────────────────────────────────────────────────────────────────
function UploadModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('880325');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', password);
      const res = await api.post('/personal/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setLoading(false);
  };

  return (
    <Modal title="📤 파일 업로드" onClose={onClose}>
      <Field label="파일 선택 (CSV / XLSX / HTML / PDF)">
        <input type="file" accept=".csv,.xlsx,.html,.htm,.pdf" onChange={e => setFile(e.target.files[0])}
          style={{ width: '100%', color: 'var(--text-primary)' }} />
      </Field>
      <Field label="비밀번호 (XLSX·PDF 암호화 파일용)">
        <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="암호화된 파일의 비밀번호" />
      </Field>
      {error && <p style={{ color: '#EF4444', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}
      {result && (
        <div style={{ padding: '10px 14px', background: '#10B98122', borderRadius: 10, fontSize: '0.85rem', color: '#10B981', marginBottom: 12 }}>
          ✅ {result.message}
        </div>
      )}
      <SaveBtn onClick={handleUpload} label={loading ? '업로드 중...' : '업로드'} />
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 커스텀 툴팁 (차트용)
// ─────────────────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem' }}>
      <div style={{ color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{formatMonth(label)}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color }}>
          <span>{p.name}</span><strong>{formatAmount(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────────────
export function PersonalPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('sean_auth') === '1');
  const [activeTab, setActiveTab] = useState('assets');
  const [month, setMonth] = useState(getCurrentMonth());

  // 자산 데이터
  const [realestate, setRealestate] = useState([]);
  const [savings, setSavings] = useState([]);

  // 지출 데이터
  const [livingItems, setLivingItems] = useState([]);
  const [livingTab, setLivingTab] = useState('living');

  // 분석 데이터
  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState([]);

  // 모달
  const [reModal, setReModal] = useState(null);
  const [svModal, setSvModal] = useState(null);
  const [liModal, setLiModal] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);

  const loadAssets = useCallback(async () => {
    const [r, s] = await Promise.all([api.get('/personal/realestate'), api.get('/personal/savings')]);
    setRealestate(r.data || []);
    setSavings(s.data || []);
  }, []);

  const loadLiving = useCallback(async () => {
    const res = await api.get('/personal/living-items', { params: { month } });
    setLivingItems(res.data || []);
  }, [month]);

  const loadAnalytics = useCallback(async () => {
    const [m, c] = await Promise.all([
      api.get('/personal/analytics/living-monthly', { params: { months: 12 } }),
      api.get('/personal/analytics/categories', { params: { month, type: '출금' } }),
    ]);
    setMonthly(m.data || []);
    setCategories(c.data || []);
  }, [month]);

  useEffect(() => { if (authed) { loadAssets(); loadLiving(); loadAnalytics(); } }, [authed, loadAssets, loadLiving, loadAnalytics]);

  if (!authed) return <PinGate onSuccess={() => setAuthed(true)} />;

  // 계산
  const totalRealestate = realestate.reduce((s, r) => s + r.value, 0);
  const totalSavings = savings.reduce((s, sv) => s + sv.monthly_amount * calcPaidMonths(sv.start_date, sv.end_date, month), 0);
  const livingExp = livingItems.filter(i => i.category === 'living').reduce((s, i) => s + i.amount, 0);
  const mgmtExp   = livingItems.filter(i => i.category === 'management').reduce((s, i) => s + i.amount, 0);
  const activeItems = livingItems.filter(i => i.category === livingTab);

  const tabs = [
    { id: 'assets',    label: '🏦 자산' },
    { id: 'spending',  label: '🧾 지출' },
    { id: 'analytics', label: '📊 분석' },
  ];

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>👤</span> Sean 개인 자산
          </h1>
          <p className="page-subtitle">개인 자산 · 지출 관리</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LocalMonthSelector value={month} onChange={setMonth} />
          <button onClick={() => { sessionStorage.removeItem('sean_auth'); setAuthed(false); }} style={{
            padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer',
          }}>🔒 잠금</button>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 14, padding: 5, marginBottom: 24, border: '1px solid var(--border-color)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontWeight: 600, fontSize: '0.9rem',
            cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === t.id ? 'var(--accent-blue)' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ 자산 탭 ══════════════════════════════════════════════════════════ */}
      {activeTab === 'assets' && (
        <>
          {/* 총 자산 요약 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
            {[
              { label: '총 자산', value: totalRealestate + totalSavings, color: 'var(--accent-blue)', big: true },
              { label: '🏠 부동산', value: totalRealestate, color: '#F59E0B' },
              { label: '💳 적금 납입', value: totalSavings, color: '#6366F1' },
            ].map((c, i) => (
              <div key={i} className="card" style={{ textAlign: 'center', padding: '18px 16px', borderTop: `3px solid ${c.color}` }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: c.big ? '1.55rem' : '1.3rem', fontWeight: 800, color: c.color }}>
                  {formatAmount(c.value)}
                </div>
              </div>
            ))}
          </div>

          {/* 부동산 + 적금 카드 */}
          <div className="grid-2" style={{ marginBottom: 24 }}>
            {/* 부동산 */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <span className="card-title">🏠 부동산</span>
                <Btn label="+ 등록" color="var(--accent-blue)" onClick={() => setReModal('add')} small />
              </div>
              {realestate.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>등록된 부동산이 없습니다</p>
                : realestate.map(r => (
                  <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        {r.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.note}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#F59E0B' }}>{formatAmount(r.value)}</span>
                        <Btn label="수정" color="var(--accent-blue)" onClick={() => setReModal(r)} small />
                        <Btn label="삭제" color="var(--accent-red)" onClick={async () => {
                          if (!confirm(`'${r.name}'을 삭제할까요?`)) return;
                          await api.delete(`/personal/realestate/${r.id}`);
                          setRealestate(prev => prev.filter(x => x.id !== r.id));
                        }} small />
                      </div>
                    </div>
                  </div>
                ))
              }
              <div style={{ paddingTop: 12, borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>합계 {formatAmount(totalRealestate)}</span>
              </div>
            </div>

            {/* 적금 */}
            <div className="card">
              <div className="card-header" style={{ marginBottom: 14 }}>
                <span className="card-title">💳 적금 / 저금</span>
                <Btn label="+ 등록" color="var(--accent-blue)" onClick={() => setSvModal('add')} small />
              </div>
              {savings.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>등록된 적금이 없습니다</p>
                : savings.map(sv => {
                  const total = sv.monthly_amount * calcMonthDiff(sv.start_date, sv.end_date);
                  const paid = sv.monthly_amount * calcPaidMonths(sv.start_date, sv.end_date, month);
                  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                  return (
                    <div key={sv.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{sv.name}</div>
                          <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>
                            월 {formatAmountShort(sv.monthly_amount)} × {calcPaidMonths(sv.start_date, sv.end_date, month)}개월 납입 | 만기 {formatAmountShort(total)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: '#6366F1' }}>{formatAmount(paid)}</span>
                          <Btn label="수정" color="var(--accent-blue)" onClick={() => setSvModal(sv)} small />
                          <Btn label="삭제" color="var(--accent-red)" onClick={async () => {
                            if (!confirm(`'${sv.name}'을 삭제할까요?`)) return;
                            await api.delete(`/personal/savings/${sv.id}`);
                            setSavings(prev => prev.filter(x => x.id !== sv.id));
                          }} small />
                        </div>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#6366F1', borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>{pct}%</div>
                    </div>
                  );
                })
              }
              <div style={{ paddingTop: 12, borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontWeight: 700, color: '#6366F1' }}>합계 {formatAmount(totalSavings)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ 지출 탭 ══════════════════════════════════════════════════════════ */}
      {activeTab === 'spending' && (
        <>
          {/* 요약 */}
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {[
              { icon: '🛒', label: '월 생활비', value: livingExp, color: '#EF4444', cat: 'living' },
              { icon: '🏢', label: '월 관리비', value: mgmtExp, color: '#F59E0B', cat: 'management' },
            ].map(c => (
              <div key={c.cat} className="card" onClick={() => setLivingTab(c.cat)} style={{
                cursor: 'pointer', textAlign: 'center', padding: '18px 16px',
                borderTop: `3px solid ${c.color}`,
                outline: livingTab === c.cat ? `2px solid ${c.color}` : 'none',
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>{c.icon} {c.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: c.color }}>{formatAmount(c.value)}</div>
              </div>
            ))}
          </div>

          {/* 내역 테이블 */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 0, background: 'var(--bg-tertiary)', borderRadius: 10, padding: 4 }}>
                {[['living', '🛒 생활비'], ['management', '🏢 관리비']].map(([v, l]) => (
                  <button key={v} onClick={() => setLivingTab(v)} style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    background: livingTab === v ? 'var(--accent-blue)' : 'transparent',
                    color: livingTab === v ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s',
                  }}>{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn label="📤 파일 업로드" color="var(--accent-green)" onClick={() => setUploadModal(true)} />
                <Btn label="+ 항목 추가" color="var(--accent-blue)" onClick={() => setLiModal({ isNew: true })} />
              </div>
            </div>

            {activeItems.length === 0
              ? <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: '0.9rem' }}>내역이 없습니다. 파일 업로드 또는 직접 추가하세요.</div>
                </div>
              : <div className="table-container" style={{ border: 'none' }}>
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
                          <td style={{ textAlign: 'right', fontWeight: 700, color: livingTab === 'living' ? '#EF4444' : '#F59E0B' }}>
                            {formatAmount(item.amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.is_recurring
                              ? <span style={{ background: 'var(--accent-purple)22', color: 'var(--accent-purple)', borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>매월</span>
                              : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>단건</span>}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.note || '-'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <Btn label="수정" color="var(--accent-blue)" onClick={() => setLiModal(item)} small />
                              <Btn label="삭제" color="var(--accent-red)" small onClick={async () => {
                                if (!confirm(`'${item.name}'을 삭제할까요?`)) return;
                                await api.delete(`/personal/living-items/${item.id}`);
                                setLivingItems(prev => prev.filter(x => x.id !== item.id));
                              }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: 700, paddingTop: 12 }}>합계</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, paddingTop: 12, color: livingTab === 'living' ? '#EF4444' : '#F59E0B' }}>
                          {formatAmount(activeItems.reduce((s, i) => s + i.amount, 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
            }
          </div>
        </>
      )}

      {/* ══ 분석 탭 ══════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <>
          {/* 요약 3카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
            {[
              { label: '이번 달 총 지출', value: livingExp + mgmtExp, color: 'var(--accent-blue)', big: true },
              { label: '🛒 생활비', value: livingExp, color: '#EF4444' },
              { label: '🏠 관리비', value: mgmtExp, color: '#F59E0B' },
            ].map((c, i) => (
              <div key={i} className="card" style={{ textAlign: 'center', padding: '18px 16px', borderTop: `3px solid ${c.color}` }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: c.big ? '1.55rem' : '1.3rem', fontWeight: 800, color: c.color }}>
                  {(livingExp + mgmtExp > 0 || !c.big) ? formatAmount(c.value) : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* 카테고리별 */}
          {categories.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 16 }}>
                <span className="card-title">🏷️ 카테고리별 지출</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatMonth(month)} · {categories.reduce((s, c) => s + c.count, 0)}건</span>
              </div>
              {categories.map((cat, idx) => (
                <div key={idx} style={{ padding: '10px 0', borderBottom: idx < categories.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '1.1rem' }}>{cat.icon || '📦'}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.name || '미분류'}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.count}건</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cat.percentage ?? 0}%</span>
                      <span style={{ fontWeight: 700, color: cat.color || 'var(--text-primary)', minWidth: 80, textAlign: 'right' }}>{formatAmount(cat.total)}</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cat.percentage ?? 0}%`, background: cat.color || 'var(--accent-blue)', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, marginTop: 4, borderTop: '2px solid var(--border-color)' }}>
                <span style={{ fontWeight: 700 }}>합계 {formatAmount(categories.reduce((s, c) => s + c.total, 0))}</span>
              </div>
            </div>
          )}

          {/* 월별 차트 */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 20 }}>
              <span className="card-title">📊 월별 지출 비교</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>최근 12개월</span>
            </div>
            {monthly.length > 0
              ? <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthly} barGap={4} barCategoryGap="32%">
                    <XAxis dataKey="month" stroke="#64748B" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(2).replace('-', '/')} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11 }} tickFormatter={formatAmountShort} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="living" name="생활비" radius={[3, 3, 0, 0]}>
                      {monthly.map((e, i) => <Cell key={i} fill={e.month === month ? '#EF4444' : '#EF444455'} />)}
                    </Bar>
                    <Bar dataKey="management" name="관리비" radius={[3, 3, 0, 0]}>
                      {monthly.map((e, i) => <Cell key={i} fill={e.month === month ? '#F59E0B' : '#F59E0B55'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              : <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📉</div>
                  <div>파일 업로드 후 월별 비교 그래프가 표시됩니다</div>
                </div>
            }
          </div>
        </>
      )}

      {/* ══ 모달 ══════════════════════════════════════════════════════════════ */}
      {reModal !== null && (
        <RealEstateModal
          item={reModal === 'add' ? null : reModal}
          onClose={() => setReModal(null)}
          onSave={async (data) => {
            try {
              if (reModal === 'add') {
                const { data: d } = await api.post('/personal/realestate', data);
                setRealestate(prev => [d, ...prev]);
              } else {
                const { data: d } = await api.put(`/personal/realestate/${reModal.id}`, data);
                setRealestate(prev => prev.map(r => r.id === d.id ? d : r));
              }
              setReModal(null);
            } catch (e) { alert('저장 실패: ' + (e.response?.data?.error || e.message)); }
          }} />
      )}
      {svModal !== null && (
        <SavingsModal
          item={svModal === 'add' ? null : svModal}
          month={month}
          onClose={() => setSvModal(null)}
          onSave={async (data) => {
            try {
              if (svModal === 'add') {
                const { data: d } = await api.post('/personal/savings', data);
                setSavings(prev => [d, ...prev]);
              } else {
                const { data: d } = await api.put(`/personal/savings/${svModal.id}`, data);
                setSavings(prev => prev.map(s => s.id === d.id ? d : s));
              }
              setSvModal(null);
            } catch (e) { alert('저장 실패: ' + (e.response?.data?.error || e.message)); }
          }} />
      )}
      {liModal !== null && (
        <LivingItemModal
          item={liModal?.isNew ? null : liModal}
          defaultCategory={livingTab}
          defaultMonth={month}
          onClose={() => setLiModal(null)}
          onSave={async (data) => {
            try {
              if (liModal?.isNew) {
                const { data: d } = await api.post('/personal/living-items', data);
                setLivingItems(prev => [...prev, d]);
              } else {
                const { data: d } = await api.put(`/personal/living-items/${liModal.id}`, data);
                setLivingItems(prev => prev.map(x => x.id === d.id ? d : x));
              }
              setLiModal(null);
            } catch (e) { alert('저장 실패: ' + (e.response?.data?.error || e.message)); }
          }} />
      )}
      {uploadModal && (
        <UploadModal onClose={() => setUploadModal(false)} onDone={() => { loadLiving(); loadAnalytics(); }} />
      )}
    </div>
  );
}
