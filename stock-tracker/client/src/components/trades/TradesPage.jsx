import { useState, useEffect } from 'react';
import { trades as tradesApi } from '../../api/client';
import { fmtCurrency, fmtDate, fmtNumber, pnlColor } from '../../utils/formatters';

const th = { padding: '8px 10px', background: 'var(--bg3)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

const STRATEGIES = ['All', 'CSP', 'Covered Call', 'BS', 'BB', 'BPS', 'BCS', 'CBS', 'DS Hammer', 'Calendar Spread', 'Iron Condor', 'EPS', 'ESS', 'Leap'];

export default function TradesPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState({ status: 'all', strategy: '', symbol: '' });

  useEffect(() => {
    const params = {};
    if (filter.status !== 'all') params.status = filter.status;
    if (filter.strategy && filter.strategy !== 'All') params.strategy = filter.strategy;
    if (filter.symbol) params.symbol = filter.symbol;
    tradesApi.getAll(params).then(setRows);
  }, [filter]);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          placeholder="Filter by symbol…"
          value={filter.symbol}
          onChange={e => setFilter(f => ({ ...f, symbol: e.target.value }))}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px', width: '160px' }}
        />
        <select
          value={filter.strategy}
          onChange={e => setFilter(f => ({ ...f, strategy: e.target.value }))}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px' }}
        >
          {STRATEGIES.map(s => <option key={s}>{s}</option>)}
        </select>
        {['all', 'open', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(f => ({ ...f, status: s }))}
            style={{
              background: filter.status === s ? 'var(--accent)' : 'var(--bg3)',
              border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)',
              padding: '6px 14px', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
        <span style={{ color: 'var(--muted)', fontSize: '12px', alignSelf: 'center' }}>{rows.length} trades</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Symbol</th>
              <th style={th}>Name</th>
              <th style={th}>Strategy</th>
              <th style={th}>Stock Px</th>
              <th style={th}>Strike</th>
              <th style={th}>Order Px</th>
              <th style={th}>Contracts</th>
              <th style={th}>Max Profit</th>
              <th style={th}>Max Loss</th>
              <th style={th}>P/L</th>
              <th style={th}>Bought</th>
              <th style={th}>Closed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600, color: 'var(--accent2)' }}>{r.symbol}</td>
                <td style={td}>{r.name || '—'}</td>
                <td style={td}>{r.strategy || '—'}</td>
                <td style={td}>{r.stock_price ? fmtCurrency(r.stock_price) : '—'}</td>
                <td style={{ ...td, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.strike || '—'}</td>
                <td style={td}>{r.order_price ? fmtCurrency(r.order_price) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.contracts}</td>
                <td style={td}>{r.max_profit ? fmtCurrency(r.max_profit) : '—'}</td>
                <td style={td}>{r.max_loss ? fmtCurrency(r.max_loss) : '—'}</td>
                <td style={{ ...td, color: pnlColor(r.pl) }}>{r.pl ? fmtCurrency(r.pl) : '—'}</td>
                <td style={td}>{fmtDate(r.bought_date)}</td>
                <td style={{ ...td, color: r.closed_date ? 'var(--muted)' : 'var(--green)' }}>
                  {r.closed_date || 'Open'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No trades found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
