import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useFetch } from '../hooks/useFetch';
import { Loading } from '../components/common/Loading';
import api from '../utils/api';

const ICONS = ['💰', '📈', '🏠', '🛒', '🍽️', '🚇', '🏥', '📚', '🎉', '📦', '🎮', '✈️', '💊', '🐾', '🎁', '💻', '👗', '⚽', '🍺', '☕'];
const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#F97316', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6', '#6B7280', '#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED'];

export function SettingsPage() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">설정</h1>
        <p className="page-subtitle">카테고리 및 분류 규칙을 관리합니다</p>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
          📂 카테고리 관리
        </button>
        <button className={`tab ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
          🏷️ 분류 규칙
        </button>
      </div>

      {activeTab === 'categories' ? <CategoryManager dispatch={dispatch} /> : <RuleManager categories={state.categories} />}
    </div>
  );
}

function CategoryManager({ dispatch }) {
  const { data: cats, loading, refetch } = useFetch('/categories');
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data? }
  const [form, setForm] = useState({ name: '', color: '#6B7280', icon: '📦', budget: '' });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setForm({ name: '', color: '#6B7280', icon: '📦', budget: '' });
    setModal({ mode: 'add' });
  };

  const openEdit = (cat) => {
    setForm({ name: cat.name, color: cat.color, icon: cat.icon, budget: cat.budget ? String(cat.budget) : '' });
    setModal({ mode: 'edit', data: cat });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert('이름을 입력하세요');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/categories', { ...form, budget: parseInt(form.budget) || 0 });
      } else {
        await api.put(`/categories/${modal.data.id}`, { ...form, budget: parseInt(form.budget) || 0 });
      }
      await refetch();
      dispatch({ type: 'SET_CATEGORIES', payload: await api.get('/categories').then(r => r.data) });
      setModal(null);
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`"${cat.name}" 카테고리를 삭제하시겠습니까?\n해당 카테고리의 거래는 '기타'로 재분류됩니다.`)) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      await refetch();
      dispatch({ type: 'SET_CATEGORIES', payload: await api.get('/categories').then(r => r.data) });
    } catch (err) {
      alert('삭제 실패: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <Loading />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openAdd}>+ 카테고리 추가</button>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>아이콘</th>
                <th>이름</th>
                <th>색상</th>
                <th>월 예산</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {(cats || []).map(cat => (
                <tr key={cat.id}>
                  <td style={{ fontSize: '1.3rem' }}>{cat.icon}</td>
                  <td style={{ fontWeight: 500 }}>{cat.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: cat.color }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cat.color}</span>
                    </div>
                  </td>
                  <td>{cat.budget > 0 ? cat.budget.toLocaleString() + '원' : <span style={{ color: 'var(--text-muted)' }}>없음</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cat)}>편집</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3 className="modal-title">{modal.mode === 'add' ? '카테고리 추가' : '카테고리 편집'}</h3>

            <div className="form-group">
              <label className="form-label">아이콘 선택</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    style={{
                      padding: '6px 10px', fontSize: '1.2rem', cursor: 'pointer',
                      background: form.icon === icon ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                      border: '1px solid var(--border)', borderRadius: 6,
                    }}
                    onClick={() => setForm(f => ({ ...f, icon }))}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="카테고리 이름" />
            </div>

            <div className="form-group">
              <label className="form-label">색상</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {COLORS.map(color => (
                  <div
                    key={color}
                    onClick={() => setForm(f => ({ ...f, color }))}
                    style={{
                      width: 28, height: 28, borderRadius: 6, background: color, cursor: 'pointer',
                      border: form.color === color ? '3px solid white' : '2px solid transparent',
                      outline: form.color === color ? `2px solid ${color}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">월 예산 (선택)</label>
              <input
                className="input"
                type="text"
                value={form.budget}
                onChange={e => setForm(f => ({ ...f, budget: e.target.value.replace(/[^0-9]/g, '') }))}
                placeholder="예: 300000"
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RuleManager({ categories }) {
  const { data: rules, loading, refetch } = useFetch('/rules');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ keyword: '', category_id: '', priority: 0 });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setForm({ keyword: '', category_id: categories[0]?.id || '', priority: 0 });
    setModal({ mode: 'add' });
  };

  const openEdit = (rule) => {
    setForm({ keyword: rule.keyword, category_id: rule.category_id, priority: rule.priority });
    setModal({ mode: 'edit', data: rule });
  };

  const handleSave = async () => {
    if (!form.keyword.trim()) return alert('키워드를 입력하세요');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.post('/rules', form);
      } else {
        await api.put(`/rules/${modal.data.id}`, form);
      }
      await refetch();
      setModal(null);
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 규칙을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/rules/${id}`);
      await refetch();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          거래처 또는 메모에 키워드가 포함되면 해당 카테고리로 자동 분류됩니다.
        </p>
        <button className="btn btn-primary" onClick={openAdd}>+ 규칙 추가</button>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>키워드</th>
                <th>분류 카테고리</th>
                <th>우선순위</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {(rules || []).map(rule => (
                <tr key={rule.id}>
                  <td><code style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.85rem' }}>{rule.keyword}</code></td>
                  <td>
                    <span className="badge" style={{ background: (rule.category_color || '#6B7280') + '22', color: rule.category_color || '#6B7280' }}>
                      {rule.category_icon} {rule.category_name}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{rule.priority}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(rule)}>편집</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule.id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h3 className="modal-title">{modal.mode === 'add' ? '규칙 추가' : '규칙 편집'}</h3>

            <div className="form-group">
              <label className="form-label">키워드</label>
              <input
                className="input"
                value={form.keyword}
                onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                placeholder="예: 스타벅스, 이마트, 병원"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>거래처 또는 메모에 이 키워드가 포함되면 자동 분류됩니다</span>
            </div>

            <div className="form-group">
              <label className="form-label">카테고리</label>
              <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">우선순위 (높을수록 먼저 적용)</label>
              <input
                className="input"
                type="number"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                min="0"
                max="100"
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
