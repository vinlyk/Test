import { useState } from 'react';
import { positions as positionsApi } from '../../api/client';
import usePortfolioStore from '../../store/portfolioStore';
import PositionGroupHeader from './PositionGroupHeader';
import PositionRow from './PositionRow';
import TradeForm from '../trade/TradeForm';

const thStyle = {
  padding: '8px 10px',
  background: 'var(--bg3)',
  color: 'var(--muted)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)',
};

export default function PositionsTable({ onReload }) {
  const positions = usePortfolioStore(s => s.positions);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  // Group by underlying
  const groups = {};
  for (const p of positions) {
    if (!groups[p.underlying]) groups[p.underlying] = [];
    groups[p.underlying].push(p);
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this position?')) return;
    await positionsApi.remove(id);
    onReload();
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setAdding(true)}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 16px', fontSize: '13px' }}
        >
          + Add Position
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Symbol</th>
            <th style={thStyle}>Strategy</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Cost</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Last</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Unreal P/L</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Day P/L</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Delta</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Gamma</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Theta</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Vega</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>IV</th>
            <th style={thStyle}>Expiry</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([underlying, legs]) => (
            <>
              <PositionGroupHeader key={`grp-${underlying}`} underlying={underlying} legs={legs} />
              {legs.map(pos => (
                <PositionRow
                  key={pos.id}
                  pos={pos}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                />
              ))}
            </>
          ))}
          {positions.length === 0 && (
            <tr>
              <td colSpan={14} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                No positions. Add one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {(editing || adding) && (
        <TradeForm
          initial={editing}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSaved={() => { setEditing(null); setAdding(false); onReload(); }}
        />
      )}
    </div>
  );
}
