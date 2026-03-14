import usePortfolioStore from '../../store/portfolioStore';
import { usePrices } from '../../hooks/usePrices';

export default function Header({ title }) {
  const { currency, toggleCurrency, autoRefresh, setAutoRefresh, refreshing, lastRefresh, marketOpen } = usePortfolioStore();
  const { refresh } = usePrices();

  return (
    <header style={{
      height: '56px',
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <h1 style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!marketOpen && (
          <span style={{ fontSize: '11px', background: 'var(--bg3)', padding: '3px 8px', borderRadius: '12px', color: 'var(--muted)' }}>
            Market Closed
          </span>
        )}
        {lastRefresh && (
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            Updated {new Date(lastRefresh).toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={refreshing}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            padding: '5px 12px',
            fontSize: '12px',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? 'Refreshing…' : '↺ Refresh'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
          />
          Auto
        </label>
        <button
          onClick={toggleCurrency}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {currency}
        </button>
      </div>
    </header>
  );
}
