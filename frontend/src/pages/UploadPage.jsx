import { useState, useRef } from 'react';
import api from '../utils/api';

const FILE_TYPES = {
  xlsx: { label: '토스뱅크 거래내역 (XLSX)', icon: '🟩', color: '#10B981', category: '생활비' },
  csv:  { label: '토스뱅크 거래내역 (CSV)',  icon: '📊', color: '#3B82F6', category: '생활비' },
  html: { label: '우리은행 보안메일 (HTML)', icon: '🏦', color: '#F59E0B', category: '관리비' },
  htm:  { label: '우리은행 보안메일 (HTM)',  icon: '🏦', color: '#F59E0B', category: '관리비' },
};

function getExt(file) {
  return file?.name.split('.').pop().toLowerCase() || '';
}

export function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const ext = getExt(file);
  const fileInfo = FILE_TYPES[ext] || null;
  const accentColor = fileInfo?.color || 'var(--accent-blue)';

  const handleSelect = (f) => {
    if (!f) return;
    const e = getExt(f);
    if (!FILE_TYPES[e]) {
      setStatus({ type: 'error', message: 'CSV, XLSX, HTML 파일만 업로드 가능합니다' });
      setFile(null);
      return;
    }
    setFile(f);
    setStatus(null);
  };

  const uploadFile = async () => {
    if (!file || loading) return;
    setLoading(true);
    setStatus(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStatus({ type: 'success', ...res.data });
      setFile(null);
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">파일 업로드</h1>
        <p className="page-subtitle">토스뱅크(생활비) 또는 우리은행(관리비) 거래내역 파일을 업로드하세요</p>
      </div>

      {/* 지원 파일 안내 */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '1.4rem' }}>🟩</span>
            <span style={{ fontWeight: 700 }}>토스뱅크 거래내역</span>
            <span style={{ background: '#10B98118', color: '#10B981', borderRadius: 5, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>생활비</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>📎 <strong>.xlsx</strong> (비밀번호 보호) · <strong>.csv</strong></div>
            <div>🔐 비밀번호 자동 처리 (880325)</div>
            <div>📱 토스뱅크 앱 → 계좌 → ··· → 거래내역 내보내기</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '1.4rem' }}>🏦</span>
            <span style={{ fontWeight: 700 }}>우리은행 보안메일</span>
            <span style={{ background: '#F59E0B18', color: '#F59E0B', borderRadius: 5, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700 }}>관리비</span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>📎 <strong>.html</strong> (보안메일 첨부파일)</div>
            <div>🔐 비밀번호 자동 처리 (880325)</div>
            <div>📧 우리은행 계좌거래내역 이메일 → 첨부파일 저장</div>
          </div>
        </div>
      </div>

      {/* 드롭존 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleSelect(e.dataTransfer.files[0]); }}
        onClick={() => !loading && fileInputRef.current?.click()}
        style={{
          background: dragging ? `${accentColor}18` : file ? `${accentColor}08` : 'var(--bg-secondary)',
          border: `2px dashed ${dragging || file ? accentColor : 'var(--border-light)'}`,
          borderRadius: 'var(--radius)',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          marginBottom: 16,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.html,.htm"
          style={{ display: 'none' }}
          onChange={e => { handleSelect(e.target.files[0]); e.target.value = ''; }}
        />
        {loading ? (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
            <div style={{ color: 'var(--text-secondary)' }}>업로드 및 복호화 처리 중...</div>
          </div>
        ) : file ? (
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{fileInfo?.icon || '📄'}</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: accentColor }}>{file.name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB &nbsp;·&nbsp;
              <span style={{ background: `${accentColor}18`, color: accentColor, borderRadius: 5, padding: '1px 8px', fontWeight: 700 }}>
                {fileInfo?.category}로 반영
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>다른 파일로 바꾸려면 다시 클릭</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>📤</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 6 }}>파일을 드래그하거나 클릭해서 선택</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>.csv &nbsp;·&nbsp; .xlsx &nbsp;·&nbsp; .html 지원</div>
          </div>
        )}
      </div>

      {/* 업로드 버튼 */}
      {file && (
        <button
          onClick={uploadFile}
          disabled={loading}
          style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none',
            background: accentColor, color: '#fff', fontSize: '1rem',
            fontWeight: 700, cursor: 'pointer', marginBottom: 20,
            boxShadow: `0 4px 16px ${accentColor}44`,
          }}
        >
          {loading ? '처리 중...' : '업로드 및 분석 시작'}
        </button>
      )}

      {/* 결과 */}
      {status && (
        <div className={`alert alert-${status.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 24 }}>
          {status.type === 'success' ? (
            <div>
              <strong>✅ 업로드 완료!</strong>
              <div style={{ marginTop: 10, fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>📁 파일 유형: <strong>{
                  status.fileType === 'woori' ? '우리은행 관리비' :
                  status.fileType === 'toss-xlsx' ? '토스뱅크 생활비 (XLSX)' : '토스뱅크 생활비 (CSV)'
                }</strong></div>
                <div>📥 총 처리: <strong>{status.total}</strong>건</div>
                <div>✅ 거래내역 추가: <strong style={{ color: 'var(--accent-green)' }}>{status.inserted}</strong>건</div>
                <div>⏭️ 중복 생략: <strong style={{ color: 'var(--text-muted)' }}>{status.skipped}</strong>건</div>
                {status.livingInserted > 0 && (
                  <div>📊 생활비/관리비 항목 추가: <strong style={{ color: '#3B82F6' }}>{status.livingInserted}</strong>건</div>
                )}
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

      {/* 반영 위치 안내 */}
      <div className="card">
        <div className="card-header"><span className="card-title">💡 업로드 후 반영 위치</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.85rem' }}>
          {[
            ['📋 거래 내역', '전체 거래내역 목록에 추가'],
            ['📈 지출 분석', '카테고리별 지출 차트에 반영'],
            ['📊 대시보드', '생활비 / 관리비 항목에 반영'],
          ].map(([title, desc]) => (
            <div key={title} style={{ flex: '1 1 160px', background: 'var(--bg-tertiary)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
