import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, ScanLine, ArrowLeftRight,
  Truck, Users, LogOut
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard',    section: 'main' },
  { to: '/items',        icon: Package,         label: 'Master Item',  section: 'main' },
  { to: '/scan',         icon: ScanLine,        label: 'Scan Barang',  section: 'main' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Transaksi',    section: 'warehouse' },
  { to: '/suppliers',    icon: Truck,           label: 'Supplier',     section: 'warehouse' },
  { to: '/users',        icon: Users,           label: 'Manajemen User', section: 'admin', adminOnly: true },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);
  const mainItems    = visibleItems.filter(i => i.section === 'main');
  const whItems      = visibleItems.filter(i => i.section === 'warehouse');
  const adminItems   = visibleItems.filter(i => i.section === 'admin');

  const roleLabel = { ADMIN: 'Administrator', PPIC: 'PPIC', STAFF: 'Staff Gudang' };

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">📦</div>
          <div className="sidebar-logo-text">
            <h2>WhereHouse</h2>
            <p>Inventory System</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu Utama</div>
          {mainItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          <div className="nav-section-title" style={{ marginTop: 8 }}>Gudang</div>
          {whItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}

          {adminItems.length > 0 && (
            <>
              <div className="nav-section-title" style={{ marginTop: 8 }}>Admin</div>
              {adminItems.map(item => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{roleLabel[user?.role]}</div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
