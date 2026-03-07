import { NavLink, Outlet } from 'react-router-dom';

const familyNavItems = [
  { to: '/',             icon: '📊', label: '대시보드' },
  { to: '/upload',       icon: '📤', label: '파일 업로드' },
  { to: '/analytics',    icon: '📈', label: '지출 분석' },
  { to: '/transactions', icon: '📋', label: '거래 내역' },
  { to: '/settings',     icon: '⚙️',  label: '설정' },
];

export function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">
            <span>💑</span>
            <span>우리 가족 자산</span>
          </div>
          <div className="sidebar-logo-sub">부부 공동 자산 관리</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">공동 자산</div>
            {familyNavItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="nav-section" style={{ marginTop: 16 }}>
            <div className="nav-section-label">개인 자산</div>
            <NavLink
              to="/personal"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              style={({ isActive }) => isActive ? {} : { color: 'var(--text-muted)' }}
            >
              <span className="nav-icon">👤</span>
              Sean
              <span style={{
                marginLeft: 'auto', fontSize: '0.65rem', padding: '2px 6px',
                background: 'var(--accent-purple)22', color: 'var(--accent-purple)',
                borderRadius: 6, fontWeight: 700,
              }}>🔒</span>
            </NavLink>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
