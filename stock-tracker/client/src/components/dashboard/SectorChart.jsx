import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import usePortfolioStore from '../../store/portfolioStore';
import { fmtCurrency } from '../../utils/formatters';

const SECTOR_COLORS = {
  'Tech':          '#6366f1',
  'Communications':'#22c55e',
  'Healthcare':    '#06b6d4',
  'Financial':     '#eab308',
  'Consumer':      '#f97316',
  'SaaS':          '#a855f7',
  'Security':      '#ef4444',
  'Crypto':        '#f59e0b',
  'BitCoin':       '#f59e0b',
  'Energy':        '#84cc16',
  'Industrials':   '#14b8a6',
  'Other':         '#94a3b8',
};

function getColor(sector, idx) {
  return SECTOR_COLORS[sector] || Object.values(SECTOR_COLORS)[idx % Object.values(SECTOR_COLORS).length];
}

export default function SectorChart() {
  const positions = usePortfolioStore(s => s.positions);
  const { currency, toDisplay } = usePortfolioStore();

  // Group by category/sector
  const bySector = {};
  for (const p of positions) {
    const sector = p.category || 'Other';
    const mv = (p.currentPrice ?? p.avg_cost) * Math.abs(p.quantity) * (p.position_type !== 'stock' ? 100 : 1);
    bySector[sector] = (bySector[sector] || 0) + mv;
  }

  const data = Object.entries(bySector)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: toDisplay(value) }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No positions to chart</div>;
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
      <ResponsiveContainer width={280} height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={110}
            innerRadius={50}
            dataKey="value"
            labelLine={false}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={getColor(entry.name, idx)} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => fmtCurrency(v, currency)} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend table */}
      <div style={{ flex: 1, minWidth: 200 }}>
        {data.map((entry, idx) => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: getColor(entry.name, idx), flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>{entry.name}</span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', marginRight: '8px' }}>
              {((entry.value / total) * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtCurrency(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
