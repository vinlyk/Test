import usePortfolioStore from '../../store/portfolioStore';
import { fmtCurrency, fmtPnl, pnlColor } from '../../utils/formatters';
import PnlChart from './PnlChart';

const card = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '16px 20px',
};

export default function Dashboard() {
  const positions = usePortfolioStore(s => s.positions);
  const { currency, toDisplay } = usePortfolioStore();

  const totalUnrealized = positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalToday = positions.reduce((s, p) => s + (p.todayPnl ?? 0), 0);
  const totalRealized = positions.reduce((s, p) => s + (p.realized_pnl ?? 0), 0);
  const marketValue = positions.reduce((s, p) => {
    const price = p.currentPrice ?? p.avg_cost;
    return s + price * Math.abs(p.quantity) * (p.position_type !== 'stock' ? 100 : 1);
  }, 0);

  const disp = (v) => fmtCurrency(toDisplay(v), currency);

  const stats = [
    { label: 'Market Value', value: disp(marketValue), color: 'var(--text)' },
    { label: 'Unrealized P/L', value: fmtPnl(toDisplay(totalUnrealized), currency), color: pnlColor(totalUnrealized) },
    { label: "Today's P/L", value: fmtPnl(toDisplay(totalToday), currency), color: pnlColor(totalToday) },
    { label: 'Realized P/L', value: fmtPnl(toDisplay(totalRealized), currency), color: pnlColor(totalRealized) },
    { label: 'Positions', value: positions.length, color: 'var(--accent2)' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ ...card, marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--muted)' }}>Portfolio Allocation</div>
        <PnlChart />
      </div>
    </div>
  );
}
