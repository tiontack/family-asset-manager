import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/',             icon: '📊', label: '대시보드' },
  { to: '/upload',       icon: '📁', label: 'CSV 업로드' },
  { to: '/analytics',    icon: '📈', label: '지출 분석' },
  { to: '/transactions', icon: '📋', label: '거래 내역' },
  { to: '/forecast',     icon: '🔮', label: '자산 예측' },
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
            <div className="nav-section-label">메뉴</div>
            {navItems.map(item => (
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
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
