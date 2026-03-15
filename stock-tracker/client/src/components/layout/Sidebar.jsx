import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',           label: 'Dashboard',     icon: '📊' },
  { to: '/positions',  label: 'Positions',     icon: '📈' },
  { to: '/watchlist',  label: 'Watchlist',     icon: '👁' },
  { to: '/trades',     label: 'TOS Tracker',   icon: '📓' },
  { to: '/pp-trades',  label: 'Options Log',   icon: '🎯' },
  { to: '/account',    label: 'Account',       icon: '💼' },
];

const navStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 16px',
  borderRadius: '8px',
  color: active ? '#e2e8f0' : '#94a3b8',
  background: active ? 'var(--bg3)' : 'transparent',
  fontWeight: active ? 600 : 400,
  fontSize: '14px',
  transition: 'all .15s',
});

export default function Sidebar() {
  return (
    <aside style={{
      width: 'var(--sidebar)',
      minHeight: '100vh',
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      position: 'fixed',
      top: 0,
      left: 0,
    }}>
      <div style={{ marginBottom: '24px', padding: '0 4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent2)' }}>Portfolio</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Tracker</div>
      </div>
      {links.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => navStyle(isActive)}>
          <span>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </aside>
  );
}
