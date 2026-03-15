import { useState, useEffect } from 'react';
import { watchlist as watchlistApi } from '../../api/client';
import usePortfolioStore from '../../store/portfolioStore';
import { fmtCurrency, fmtPercent, pnlColor } from '../../utils/formatters';

const th = { padding: '8px 10px', background: 'var(--bg3)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--border)' };
const td = { padding: '8px 10px', fontSize: '13px', borderBottom: '1px solid var(--border)' };

function parseLevels(json) {
  try { return JSON.parse(json) || []; } catch { return []; }
}

function getAlertState(price, levels) {
  if (!price || !levels.length) return null;
  const top = Math.max(...levels);
  if (price <= top) return 'below';
  if (price <= top * 1.02) return 'near';
  return null;
}

function WatchlistModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : {
    symbol: '', name: '', category: '', avg_cost: '',
    intrinsic_value: '', currency: 'USD', notes: '',
  });
  const [levelsText, setLevelsText] = useState(() => parseLevels(item?.support_levels).join(', '));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const inputStyle = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '7px 10px', fontSize: '13px' };
  const labelStyle = { fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.symbol) { setErr('Symbol is required'); return; }
    setSaving(true);
    try {
      const levels = levelsText.split(/[,\s]+/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const payload = {
        ...form,
        symbol: form.symbol.toUpperCase().trim(),
        avg_cost: form.avg_cost !== '' && form.avg_cost != null ? parseFloat(form.avg_cost) : null,
        support_levels: JSON.stringify(levels),
      };
      if (item?.id) { await watchlistApi.update(item.id, payload); }
      else { await watchlistApi.create(payload); }
      onSaved();
    } catch (ex) {
      setErr(ex.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '95vw' }}>
        <div style={{ fontWeight: 600, marginBottom: '16px' }}>{item?.id ? 'Edit Watchlist Item' : 'Add to Watchlist'}</div>
        {err && <div style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '8px' }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>Symbol *</label>
            <input style={inputStyle} value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} /></div>
          <div><label style={labelStyle}>Name</label>
            <input style={inputStyle} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label style={labelStyle}>Sector / Category</label>
            <input style={inputStyle} value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></div>
          <div><label style={labelStyle}>Currency</label>
            <select style={inputStyle} value={form.currency || 'USD'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option value="USD">USD</option><option value="SGD">SGD</option>
            </select></div>
          <div><label style={labelStyle}>Avg Cost</label>
            <input style={inputStyle} type="number" step="0.01" value={form.avg_cost || ''} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} /></div>
          <div><label style={labelStyle}>Intrinsic Value</label>
            <input style={inputStyle} value={form.intrinsic_value || ''} onChange={e => setForm(f => ({ ...f, intrinsic_value: e.target.value }))} placeholder="e.g. 250/220" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Support Levels (comma-separated)</label>
            <input style={inputStyle} value={levelsText} onChange={e => setLevelsText(e.target.value)} placeholder="e.g. 185, 175, 165, 155" /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '56px' }} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '7px 16px', fontSize: '13px' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '7px 16px', fontSize: '13px' }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);
  const priceCache = usePortfolioStore(s => s.priceCache);

  const load = () => watchlistApi.getAll().then(setItems);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remove from watchlist?')) return;
    await watchlistApi.remove(id);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setModal('add')} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 16px', fontSize: '13px' }}>
          + Add to Watchlist
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Symbol</th>
              <th style={th}>Name</th>
              <th style={th}>Sector</th>
              <th style={{ ...th, textAlign: 'right' }}>Live Price</th>
              <th style={{ ...th, textAlign: 'right' }}>Chg %</th>
              <th style={th}>Support Levels</th>
              <th style={th}>Intrinsic Value</th>
              <th style={th}>Notes</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const cached = priceCache[item.symbol];
              const price = cached?.price ?? null;
              const levels = parseLevels(item.support_levels);
              const alertState = getAlertState(price, levels);

              return (
                <tr key={item.id} style={{ background: alertState === 'below' ? 'rgba(239,68,68,0.07)' : alertState === 'near' ? 'rgba(234,179,8,0.06)' : 'transparent' }}>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--accent2)' }}>
                    {item.symbol}
                    {alertState === 'below' && <span style={{ marginLeft: '6px', fontSize: '10px', background: 'var(--red)', color: '#fff', borderRadius: '3px', padding: '1px 5px' }}>ALERT</span>}
                    {alertState === 'near' && <span style={{ marginLeft: '6px', fontSize: '10px', background: 'var(--yellow)', color: '#000', borderRadius: '3px', padding: '1px 5px' }}>NEAR</span>}
                  </td>
                  <td style={td}>{item.name || '—'}</td>
                  <td style={td}>{item.category || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {price != null ? fmtCurrency(price, item.currency) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', color: pnlColor(cached?.change_pct) }}>
                    {cached?.change_pct != null ? fmtPercent(cached.change_pct) : '—'}
                  </td>
                  <td style={td}>
                    {levels.length === 0 && <span style={{ color: 'var(--muted)' }}>—</span>}
                    {levels.map((s, i) => {
                      const breached = price != null && price <= s;
                      return (
                        <span key={i} style={{
                          background: breached ? 'rgba(239,68,68,0.18)' : 'var(--bg3)',
                          border: `1px solid ${breached ? 'var(--red)' : 'var(--border)'}`,
                          color: breached ? 'var(--red)' : 'var(--text)',
                          borderRadius: '4px', padding: '2px 7px', fontSize: '11px',
                          marginRight: '4px', display: 'inline-block', marginBottom: '2px',
                        }}>
                          {fmtCurrency(s, item.currency)}
                        </span>
                      );
                    })}
                  </td>
                  <td style={td}>{item.intrinsic_value || '—'}</td>
                  <td style={{ ...td, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{item.notes || '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setModal(item)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', padding: '3px 10px', fontSize: '12px' }}>Edit</button>
                      <button onClick={() => handleDelete(item.id)} style={{ background: 'transparent', border: '1px solid var(--red)', borderRadius: '4px', color: 'var(--red)', padding: '3px 10px', fontSize: '12px' }}>Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No watchlist items. Click "+ Add to Watchlist" or run seed.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <WatchlistModal
          item={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
