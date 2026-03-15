import { useState, useEffect } from 'react';
import { trades as tradesApi } from '../../api/client';
import { fmtCurrency, fmtDate, pnlColor } from '../../utils/formatters';

const th = { padding: '8px 10px', background: 'var(--bg3)', color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: '12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

const STRATEGIES = ['All', 'CSP', 'Covered Call', 'BS', 'BB', 'BPS', 'BCS', 'CBS', 'DS Hammer', 'Calendar Spread', 'Iron Condor', 'EPS', 'ESS', 'Leap'];

const EMPTY_TRADE = {
  symbol: '', name: '', strategy: '', stock_price: '', strike: '', call_price: '', put_price: '',
  order_price: '', bought_date: '', closed_date: '', max_profit: '', max_loss: '',
  profit_ratio: '', contracts: '1', pl: '', notes: '',
};

function TradeModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item, stock_price: item.stock_price ?? '', order_price: item.order_price ?? '', max_profit: item.max_profit ?? '', max_loss: item.max_loss ?? '', profit_ratio: item.profit_ratio ?? '', contracts: item.contracts ?? 1, pl: item.pl ?? '' } : { ...EMPTY_TRADE });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const inputStyle = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '7px 10px', fontSize: '13px' };
  const labelStyle = { fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' };
  const pn = (v) => v !== '' && v != null ? parseFloat(v) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.symbol) { setErr('Symbol required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        symbol: form.symbol.toUpperCase().trim(),
        stock_price: pn(form.stock_price), order_price: pn(form.order_price),
        max_profit: pn(form.max_profit), max_loss: pn(form.max_loss),
        profit_ratio: pn(form.profit_ratio), contracts: pn(form.contracts) ?? 1,
        pl: pn(form.pl),
        closed_date: form.closed_date || null,
      };
      if (item?.id) { await tradesApi.update(item.id, payload); }
      else { await tradesApi.create(payload); }
      onSaved();
    } catch (ex) { setErr(ex.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const f = (key, label, type = 'text', placeholder = '') => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} type={type} step={type === 'number' ? '0.01' : undefined}
        value={form[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflowY: 'auto', padding: '20px' }}>
      <form onSubmit={handleSubmit} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '560px', maxWidth: '95vw' }}>
        <div style={{ fontWeight: 600, marginBottom: '16px' }}>{item?.id ? 'Edit Trade' : 'Add TOS Trade'}</div>
        {err && <div style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '8px' }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {f('symbol', 'Symbol *')}
          {f('name', 'Company Name')}
          <div><label style={labelStyle}>Strategy</label>
            <select style={inputStyle} value={form.strategy || ''} onChange={e => setForm(p => ({ ...p, strategy: e.target.value }))}>
              <option value="">—</option>
              {STRATEGIES.filter(s => s !== 'All').map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {f('contracts', 'Contracts', 'number')}
          {f('stock_price', 'Stock Price', 'number')}
          {f('order_price', 'Order Price', 'number')}
          {f('strike', 'Strike', 'text', 'e.g. 185/190')}
          {f('call_price', 'Call Price')}
          {f('put_price', 'Put Price')}
          {f('max_profit', 'Max Profit', 'number')}
          {f('max_loss', 'Max Loss', 'number')}
          {f('profit_ratio', 'Profit Ratio', 'number')}
          {f('pl', 'P/L', 'number')}
          {f('bought_date', 'Bought Date', 'date')}
          {f('closed_date', 'Closed Date', 'date')}
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '52px' }} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '7px 16px', fontSize: '13px' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '7px 16px', fontSize: '13px' }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

export default function TradesPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState({ status: 'all', strategy: '', symbol: '' });
  const [modal, setModal] = useState(null);

  const load = () => {
    const params = {};
    if (filter.status !== 'all') params.status = filter.status;
    if (filter.strategy && filter.strategy !== 'All') params.strategy = filter.strategy;
    if (filter.symbol) params.symbol = filter.symbol;
    tradesApi.getAll(params).then(setRows);
  };

  useEffect(() => { load(); }, [filter]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this trade?')) return;
    await tradesApi.remove(id);
    load();
  };

  const totalPL = rows.reduce((s, r) => s + (r.pl ?? 0), 0);
  const openCount = rows.filter(r => !r.closed_date).length;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          <b style={{ color: 'var(--text)' }}>{rows.length}</b> trades &nbsp;·&nbsp;
          <b style={{ color: 'var(--green)' }}>{openCount}</b> open &nbsp;·&nbsp;
          Total P/L: <b style={{ color: pnlColor(totalPL) }}>{fmtCurrency(totalPL)}</b>
        </span>
        <button onClick={() => setModal('add')} style={{ marginLeft: 'auto', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 16px', fontSize: '13px' }}>
          + Add Trade
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input placeholder="Filter symbol…" value={filter.symbol}
          onChange={e => setFilter(f => ({ ...f, symbol: e.target.value }))}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px', width: '150px' }} />
        <select value={filter.strategy} onChange={e => setFilter(f => ({ ...f, strategy: e.target.value }))}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 10px', fontSize: '13px' }}>
          {STRATEGIES.map(s => <option key={s}>{s}</option>)}
        </select>
        {['all', 'open', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(f => ({ ...f, status: s }))}
            style={{ background: filter.status === s ? 'var(--accent)' : 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '6px 14px', fontSize: '12px', textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Symbol</th>
              <th style={th}>Strategy</th>
              <th style={th}>Stock Px</th>
              <th style={th}>Strike</th>
              <th style={th}>Order Px</th>
              <th style={{ ...th, textAlign: 'right' }}>Qty</th>
              <th style={{ ...th, textAlign: 'right' }}>Max $</th>
              <th style={{ ...th, textAlign: 'right' }}>Max Loss</th>
              <th style={{ ...th, textAlign: 'right' }}>P/L</th>
              <th style={th}>Opened</th>
              <th style={th}>Closed</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600, color: 'var(--accent2)' }}>{r.symbol}</td>
                <td style={td}>{r.strategy || '—'}</td>
                <td style={td}>{r.stock_price ? fmtCurrency(r.stock_price) : '—'}</td>
                <td style={{ ...td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.strike || '—'}</td>
                <td style={td}>{r.order_price ? fmtCurrency(r.order_price) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.contracts ?? 1}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.max_profit ? fmtCurrency(r.max_profit) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--red)' }}>{r.max_loss ? fmtCurrency(r.max_loss) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', color: pnlColor(r.pl) }}>{r.pl != null ? fmtCurrency(r.pl) : '—'}</td>
                <td style={td}>{fmtDate(r.bought_date)}</td>
                <td style={{ ...td, color: r.closed_date ? 'var(--muted)' : 'var(--green)' }}>{r.closed_date ? fmtDate(r.closed_date) : 'Open'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setModal(r)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', padding: '3px 10px', fontSize: '11px' }}>Edit</button>
                    <button onClick={() => handleDelete(r.id)} style={{ background: 'transparent', border: '1px solid var(--red)', borderRadius: '4px', color: 'var(--red)', padding: '3px 10px', fontSize: '11px' }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No trades found. Run seed or add a trade.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <TradeModal
          item={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
