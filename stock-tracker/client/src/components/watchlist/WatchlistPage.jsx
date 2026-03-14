import { useState, useEffect } from 'react';
import { watchlist as watchlistApi } from '../../api/client';
import { fmtCurrency, fmtDate } from '../../utils/formatters';

const th = { padding: '8px 10px', background: 'var(--bg3)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--border)' };
const td = { padding: '8px 10px', fontSize: '13px', borderBottom: '1px solid var(--border)' };

export default function WatchlistPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    watchlistApi.getAll().then(setItems);
  }, []);

  const parseLevels = (json) => {
    try { return JSON.parse(json) || []; } catch { return []; }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Symbol</th>
            <th style={th}>Name</th>
            <th style={th}>Category</th>
            <th style={th}>Avg Cost</th>
            <th style={th}>Intrinsic Value</th>
            <th style={th}>Support Levels</th>
            <th style={th}>Currency</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td style={{ ...td, fontWeight: 600, color: 'var(--accent2)' }}>{item.symbol}</td>
              <td style={td}>{item.name || '—'}</td>
              <td style={td}>{item.category || '—'}</td>
              <td style={td}>{item.avg_cost ? fmtCurrency(item.avg_cost, item.currency) : '—'}</td>
              <td style={td}>{item.intrinsic_value || '—'}</td>
              <td style={td}>
                {parseLevels(item.support_levels).filter(Boolean).map((s, i) => (
                  <span key={i} style={{ background: 'var(--bg3)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', marginRight: '4px' }}>
                    {fmtCurrency(s, item.currency)}
                  </span>
                ))}
              </td>
              <td style={td}>{item.currency}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No watchlist items. Run seed to import.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
