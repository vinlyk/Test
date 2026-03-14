import { useState, useEffect } from 'react';
import { account as accountApi } from '../../api/client';
import { fmtCurrency, fmtNumber, fmtPercent } from '../../utils/formatters';
import usePortfolioStore from '../../store/portfolioStore';

const card = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '16px 20px',
};
const cardLabel = { fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' };
const cardValue = { fontSize: '20px', fontWeight: 700 };

export default function AccountSummary() {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const { currency } = usePortfolioStore();

  useEffect(() => {
    accountApi.get().then(d => { setData(d); setForm(d); });
  }, []);

  const save = async () => {
    const updated = await accountApi.update(form);
    setData(updated);
    setEditing(false);
  };

  if (!data) return <div style={{ padding: '20px', color: 'var(--muted)' }}>Loading account…</div>;

  const disp = (v) => fmtCurrency(v, currency === 'SGD' ? 'SGD' : 'USD');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        {editing
          ? <><button onClick={save} style={btnStyle('var(--accent)')}>Save</button>
              <button onClick={() => setEditing(false)} style={{ ...btnStyle('var(--bg3)'), marginLeft: '8px' }}>Cancel</button></>
          : <button onClick={() => setEditing(true)} style={btnStyle('var(--bg3)')}>Edit</button>
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Market Value (SGD)', key: 'market_value_sgd' },
          { label: 'Long MV (USD)',       key: 'long_mv_usd' },
          { label: 'Short MV (USD)',      key: 'short_mv_usd' },
          { label: 'Available Funds',     key: 'available_funds_sgd' },
          { label: 'Total Cash (SGD)',    key: 'total_cash_sgd' },
          { label: 'USD Balance',         key: 'usd_balance' },
          { label: 'Max Buying Power',    key: 'max_buying_power_sgd' },
          { label: 'Excess Liquidity',    key: 'excess_liquidity_sgd' },
          { label: 'Initial Margin',      key: 'initial_margin_sgd' },
          { label: 'Maint. Margin',       key: 'maintenance_margin_sgd' },
        ].map(({ label, key }) => (
          <div key={key} style={card}>
            <div style={cardLabel}>{label}</div>
            {editing
              ? <input
                  type="number"
                  value={form[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', padding: '4px 8px', width: '100%' }}
                />
              : <div style={cardValue}>{fmtCurrency(data[key], 'SGD')}</div>
            }
          </div>
        ))}
        <div style={card}>
          <div style={cardLabel}>Leverage Ratio</div>
          <div style={cardValue}>{fmtNumber(data.leverage_ratio)}x</div>
        </div>
        <div style={card}>
          <div style={cardLabel}>Risk Level</div>
          <div style={{ ...cardValue, fontSize: '16px', color: data.risk_level === 'Low' ? 'var(--green)' : data.risk_level === 'High' ? 'var(--red)' : 'var(--yellow)' }}>
            {data.risk_level || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle = (bg) => ({
  background: bg, border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--text)', padding: '6px 14px', fontSize: '12px', cursor: 'pointer',
});
