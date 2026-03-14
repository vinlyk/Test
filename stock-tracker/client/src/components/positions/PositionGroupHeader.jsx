import { fmtCurrency, fmtNumber, pnlColor } from '../../utils/formatters';
import usePortfolioStore from '../../store/portfolioStore';

const cell = { padding: '6px 10px', fontSize: '12px', fontWeight: 700, background: 'var(--bg3)', whiteSpace: 'nowrap' };

export default function PositionGroupHeader({ underlying, legs }) {
  const { currency, toDisplay } = usePortfolioStore();
  const disp = (v) => v != null ? fmtCurrency(toDisplay(v), currency) : '—';

  const totalUnrealized = legs.reduce((s, l) => s + (l.unrealizedPnl ?? 0), 0);
  const totalToday = legs.reduce((s, l) => s + (l.todayPnl ?? 0), 0);

  // Aggregate greeks (options only)
  const optLegs = legs.filter(l => l.position_type !== 'stock');
  const sum = (key) => optLegs.reduce((s, l) => s + (l[key] ?? 0) * Math.abs(l.quantity), 0);
  const delta = sum('delta');
  const gamma = sum('gamma');
  const theta = sum('theta');
  const vega  = sum('vega');

  return (
    <tr>
      <td style={{ ...cell, color: 'var(--accent2)', fontSize: '13px' }} colSpan={2}>{underlying}</td>
      <td style={cell} />
      <td style={cell} />
      <td style={cell} />
      <td style={{ ...cell, color: pnlColor(totalUnrealized) }}>{disp(totalUnrealized)}</td>
      <td style={{ ...cell, color: pnlColor(totalToday) }}>{disp(totalToday)}</td>
      <td style={cell}>{fmtNumber(delta, 3)}</td>
      <td style={cell}>{fmtNumber(gamma, 3)}</td>
      <td style={cell}>{fmtNumber(theta, 3)}</td>
      <td style={cell}>{fmtNumber(vega, 3)}</td>
      <td style={cell} colSpan={3} />
    </tr>
  );
}
