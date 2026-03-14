import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import usePortfolioStore from '../../store/portfolioStore';
import { fmtCurrency } from '../../utils/formatters';

const COLORS = ['#6366f1','#22c55e','#eab308','#ef4444','#06b6d4','#a855f7','#f97316','#14b8a6'];

export default function PnlChart() {
  const positions = usePortfolioStore(s => s.positions);
  const { currency, toDisplay } = usePortfolioStore();

  // Group by underlying for pie chart
  const byUnderlying = {};
  for (const p of positions) {
    const mv = (p.currentPrice ?? p.avg_cost) * Math.abs(p.quantity) * (p.position_type !== 'stock' ? 100 : 1);
    byUnderlying[p.underlying] = (byUnderlying[p.underlying] || 0) + mv;
  }

  const data = Object.entries(byUnderlying)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: toDisplay(value) }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No positions to chart</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={110}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          labelLine={false}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtCurrency(v, currency)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
