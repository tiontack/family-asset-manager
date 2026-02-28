import { useState, useRef } from 'react';
import api from '../utils/api';

export function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setStatus({ type: 'error', message: 'CSV 파일만 업로드 가능합니다' });
      return;
    }

    setLoading(true);
    setStatus(null);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatus({ type: 'success', ...res.data });
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    uploadFile(file);
  };

  const handleFileChange = (e) => {
    uploadFile(e.target.files[0]);
    e.target.value = '';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">CSV 업로드</h1>
        <p className="page-subtitle">토스 앱에서 내보낸 계좌 내역 CSV 파일을 업로드하세요</p>
      </div>

      {/* 업로드 영역 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
        style={{
          background: dragging ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
          border: `2px dashed ${dragging ? 'var(--accent-blue)' : 'var(--border-light)'}`,
          borderRadius: 'var(--radius)',
          padding: '60px 32px',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          marginBottom: 28,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {loading ? (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>업로드 및 분류 중...</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 6 }}>
              CSV 파일을 여기에 드래그하거나 클릭하세요
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              토스 앱 → 계좌 → 내역 → 내보내기로 CSV 다운로드 가능
            </div>
          </div>
        )}
      </div>

      {/* 결과 메시지 */}
      {status && (
        <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 24 }}>
          {status.type === 'success' ? (
            <div>
              <strong>✅ 업로드 완료!</strong>
              <div style={{ marginTop: 8, fontSize: '0.9rem' }}>
                <div>📥 총 처리: <strong>{status.total}</strong>건</div>
                <div>✅ 신규 추가: <strong>{status.inserted}</strong>건</div>
                <div>⏭️ 중복 생략: <strong>{status.skipped}</strong>건</div>
              </div>
            </div>
          ) : (
            <div>
              <strong>❌ 오류 발생</strong>
              <div style={{ marginTop: 4 }}>{status.message}</div>
            </div>
          )}
        </div>
      )}

      {/* 안내 */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">📱 토스 CSV 내보내기 방법</span>
          </div>
          <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 2 }}>
            <li>토스 앱 → 하단 <strong style={{ color: 'var(--text-primary)' }}>자산</strong> 탭</li>
            <li>연결된 <strong style={{ color: 'var(--text-primary)' }}>계좌</strong> 선택</li>
            <li>우상단 <strong style={{ color: 'var(--text-primary)' }}>···</strong> 메뉴 클릭</li>
            <li><strong style={{ color: 'var(--text-primary)' }}>내역 내보내기</strong> 선택</li>
            <li>기간 설정 후 CSV 저장</li>
          </ol>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">🗂️ 자동 분류 카테고리</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['💰 급여/수입', '#10B981'], ['📈 저축/투자', '#6366F1'],
              ['🏠 관리비', '#F59E0B'], ['🛒 생활비', '#EF4444'],
              ['🍽️ 식비', '#F97316'], ['🚇 교통비', '#3B82F6'],
              ['🏥 의료비', '#EC4899'], ['📚 교육비', '#8B5CF6'],
              ['🎉 여가/외식', '#14B8A6'], ['📦 기타', '#6B7280'],
            ].map(([name, color]) => (
              <span
                key={name}
                className="badge"
                style={{ background: color + '22', color, border: `1px solid ${color}44`, fontSize: '0.78rem', padding: '4px 10px' }}
              >
                {name}
              </span>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            설정 페이지에서 분류 규칙을 커스터마이징할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
