export function Loading({ text = '로딩 중...' }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {text}
    </div>
  );
}

export function EmptyState({ icon = '📭', title = '데이터 없음', desc }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      {desc && <div style={{ fontSize: '0.85rem' }}>{desc}</div>}
    </div>
  );
}
