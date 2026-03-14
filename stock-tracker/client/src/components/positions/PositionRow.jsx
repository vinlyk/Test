import { fmtCurrency, fmtNumber, fmtPercent, fmtDate, pnlColor } from '../../utils/formatters';
import usePortfolioStore from '../../store/portfolioStore';

const cell = { padding: '8px 10px', fontSize: '13px', whiteSpace: 'nowrap' };

export default function PositionRow({ pos, onEdit, onDelete }) {
  const { currency, toDisplay } = usePortfolioStore();
  const isStock = pos.position_type === 'stock';
  const disp = (v) => fmtCurrency(toDisplay(v), currency);

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={cell}>{pos.symbol}</td>
      <td style={cell}>{pos.strategy_type || '—'}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{pos.quantity}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{disp(pos.avg_cost)}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{pos.currentPrice != null ? disp(pos.currentPrice) : '—'}</td>
      <td style={{ ...cell, textAlign: 'right', color: pnlColor(pos.unrealizedPnl) }}>
        {pos.unrealizedPnl != null ? disp(pos.unrealizedPnl) : '—'}
      </td>
      <td style={{ ...cell, textAlign: 'right', color: pnlColor(pos.todayPnl) }}>
        {pos.todayPnl != null ? disp(pos.todayPnl) : '—'}
      </td>
      {!isStock && <>
        <td style={{ ...cell, textAlign: 'right' }}>{fmtNumber(pos.delta, 4)}</td>
        <td style={{ ...cell, textAlign: 'right' }}>{fmtNumber(pos.gamma, 4)}</td>
        <td style={{ ...cell, textAlign: 'right' }}>{fmtNumber(pos.theta, 4)}</td>
        <td style={{ ...cell, textAlign: 'right' }}>{fmtNumber(pos.vega, 4)}</td>
        <td style={{ ...cell, textAlign: 'right' }}>{fmtPercent(pos.iv ? pos.iv * 100 : null)}</td>
        <td style={cell}>{fmtDate(pos.expiry_date)}</td>
      </>}
      {isStock && <td style={cell} colSpan={6} />}
      <td style={cell}>
        <button onClick={() => onEdit(pos)} style={btnStyle('#6366f1')}>Edit</button>
        <button onClick={() => onDelete(pos.id)} style={btnStyle('#ef4444')}>Del</button>
      </td>
    </tr>
  );
}

const btnStyle = (bg) => ({
  background: bg, border: 'none', borderRadius: '4px', color: '#fff',
  padding: '2px 8px', fontSize: '11px', marginRight: '4px',
});
