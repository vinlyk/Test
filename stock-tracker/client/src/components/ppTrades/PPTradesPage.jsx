import { useState, useEffect } from 'react';
import { ppTrades as ppApi } from '../../api/client';
import { fmtCurrency, fmtDate, fmtNumber, pnlColor } from '../../utils/formatters';

const th = { padding: '8px 10px', background: 'var(--bg3)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

const strategyBadge = (s) => {
  const colors = {
    LIZARD: '#6366f1', WING: '#22c55e', DIAGONAL: '#eab308', CALENDAR: '#06b6d4',
    'BEAR CALL': '#ef4444', IRON: '#a855f7', '(BB)': '#f97316', COLLAR: '#14b8a6',
    '(IC)': '#8b5cf6', SNIPER: '#ec4899', BULLISH: '#22c55e', CROUCHING: '#84cc16',
    '(CBS)': '#f59e0b', 'DS HAMMER': '#3b82f6', BULL: '#10b981',
  };
  return colors[s] || '#94a3b8';
};

export default function PPTradesPage() {
  const [rows, setRows] = useState([]);
  const [filterStrategy, setFilterStrategy] = useState('');

  useEffect(() => {
    const params = {};
    if (filterStrategy) params.strategy = filterStrategy;
    ppApi.getAll(params).then(setRows);
  }, [filterStrategy]);

  const strategies = [...new Set(rows.map(r => r.strategy).filter(Boolean))];

  const formatLeg = (row, n) => {
    const sym = row[`leg${n}_symbol`];
    if (!sym) return '—';
    const type = row[`leg${n}_type`];
    const strike = row[`leg${n}_strike`];
    const expiry = row[`leg${n}_expiry`];
    return `${sym} (${expiry?.slice(5)} ${type}$${strike})`;
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterStrategy}
          onChange={e => setFilterStrategy(e.target.value)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px' }}
        >
          <option value="">All Strategies</option>
          {strategies.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{rows.length} trades</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Strategy</th>
              <th style={th}>Leg 1</th>
              <th style={th}>Leg 2</th>
              <th style={th}>Entry Date</th>
              <th style={{ ...th, textAlign: 'right' }}>Qty</th>
              <th style={{ ...th, textAlign: 'right' }}>Entry Px</th>
              <th style={{ ...th, textAlign: 'right' }}>Spread $</th>
              <th style={{ ...th, textAlign: 'right' }}>DTE</th>
              <th style={{ ...th, textAlign: 'right' }}>Entry Val</th>
              <th style={{ ...th, textAlign: 'right' }}>Capital BP</th>
              <th style={{ ...th, textAlign: 'right' }}>Max Loss</th>
              <th style={{ ...th, textAlign: 'right' }}>Rolling P/L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, color: 'var(--muted)' }}>{r.trade_no}</td>
                <td style={td}>
                  <span style={{
                    background: strategyBadge(r.strategy) + '33',
                    border: `1px solid ${strategyBadge(r.strategy)}`,
                    color: strategyBadge(r.strategy),
                    borderRadius: '4px', padding: '1px 7px', fontSize: '11px', fontWeight: 600,
                  }}>
                    {r.strategy}
                  </span>
                  {r.strategy_variant && <span style={{ marginLeft: '6px', color: 'var(--muted)', fontSize: '11px' }}>{r.strategy_variant}</span>}
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent2)' }}>
                  {r.leg1_symbol || '—'}
                  {r.leg1_underlying && <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>({r.leg1_underlying} {r.leg1_type}{r.leg1_strike})</span>}
                </td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent2)' }}>
                  {r.leg2_symbol || '—'}
                  {r.leg2_underlying && <span style={{ color: 'var(--muted)', marginLeft: '4px' }}>({r.leg2_underlying} {r.leg2_type}{r.leg2_strike})</span>}
                </td>
                <td style={td}>{fmtDate(r.entry_date)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.qty_leg1}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.entry_price_leg1 ? fmtCurrency(r.entry_price_leg1) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: pnlColor(r.spread_leg1) }}>{r.spread_leg1 ? fmtCurrency(r.spread_leg1) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.dte ?? '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.entry_value ? fmtCurrency(r.entry_value) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.capital_bp ? fmtCurrency(r.capital_bp) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--red)' }}>{r.max_loss ? fmtCurrency(r.max_loss) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: pnlColor(r.rolling_pl) }}>
                  {r.rolling_pl != null ? fmtCurrency(r.rolling_pl) : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No PP trades. Run seed to import.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
