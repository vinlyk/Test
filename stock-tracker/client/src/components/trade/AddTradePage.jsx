import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { trades as tradesApi, ppTrades as ppApi } from '../../api/client';
import { parseOCC } from '../../utils/optionSymbol';

const inputStyle = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '13px' };
const label = { display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' };
const field = { marginBottom: '14px' };

function JournalForm({ onSaved }) {
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm();
  const symbol = watch('symbol');

  const onSubmit = async (data) => {
    await tradesApi.create(data);
    onSaved('Trade added to journal!');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={field}>
          <label style={label}>Symbol *</label>
          <input {...register('symbol', { required: true })} style={inputStyle} placeholder="AAPL" />
        </div>
        <div style={field}>
          <label style={label}>Strategy</label>
          <select {...register('strategy')} style={inputStyle}>
            <option value="">— select —</option>
            {['CSP','Covered Call','BS','BB','BPS','BCS','CBS','DS Hammer','Calendar Spread','Iron Condor','EPS','ESS','Leap','Butterfly'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={field}>
          <label style={label}>Stock Price at Entry</label>
          <input type="number" step="any" {...register('stock_price', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Order Price (Net)</label>
          <input type="number" step="any" {...register('order_price', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Contracts</label>
          <input type="number" {...register('contracts', { valueAsNumber: true })} style={inputStyle} defaultValue={1} />
        </div>
        <div style={field}>
          <label style={label}>Bought Date</label>
          <input type="date" {...register('bought_date')} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Max Profit</label>
          <input type="number" step="any" {...register('max_profit', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Max Loss</label>
          <input type="number" step="any" {...register('max_loss', { valueAsNumber: true })} style={inputStyle} />
        </div>
      </div>
      <div style={field}>
        <label style={label}>Strike Description</label>
        <input {...register('strike')} style={inputStyle} placeholder="e.g. Buy 175C / Sell 175P" />
      </div>
      <div style={field}>
        <label style={label}>Notes</label>
        <input {...register('notes')} style={inputStyle} />
      </div>
      <button type="submit" disabled={isSubmitting} style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '10px 24px', fontSize: '13px', cursor: 'pointer' }}>
        {isSubmitting ? 'Adding…' : 'Add to Journal'}
      </button>
    </form>
  );
}

function PPForm({ onSaved }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    await ppApi.create(data);
    onSaved('PP Trade added!');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={field}>
          <label style={label}>Trade #</label>
          <input type="number" {...register('trade_no', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Strategy *</label>
          <select {...register('strategy', { required: true })} style={inputStyle}>
            <option value="">— select —</option>
            {['LIZARD','WING','DIAGONAL','CALENDAR','BEAR CALL','IRON','(BB)','COLLAR','(IC)','SNIPER','(ESS)','BULLISH','CROUCHING','(CBS)','DS HAMMER','BULL'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={field}>
          <label style={label}>Leg 1 Symbol (OPRA, e.g. .AMZN250926C230)</label>
          <input {...register('leg1_symbol')} style={inputStyle} placeholder=".AMZN250926C230" />
        </div>
        <div style={field}>
          <label style={label}>Leg 2 Symbol (optional)</label>
          <input {...register('leg2_symbol')} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Entry Date</label>
          <input type="date" {...register('entry_date')} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>DTE</label>
          <input type="number" {...register('dte', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Qty Leg 1</label>
          <input type="number" step="any" {...register('qty_leg1', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Entry Price</label>
          <input type="number" step="any" {...register('entry_price_leg1', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Capital BP</label>
          <input type="number" step="any" {...register('capital_bp', { valueAsNumber: true })} style={inputStyle} />
        </div>
        <div style={field}>
          <label style={label}>Max Loss</label>
          <input type="number" step="any" {...register('max_loss', { valueAsNumber: true })} style={inputStyle} />
        </div>
      </div>
      <button type="submit" disabled={isSubmitting} style={{ background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', padding: '10px 24px', fontSize: '13px', cursor: 'pointer' }}>
        {isSubmitting ? 'Adding…' : 'Add PP Trade'}
      </button>
    </form>
  );
}

export default function AddTradePage() {
  const [tab, setTab] = useState('journal');
  const [msg, setMsg] = useState('');

  const tabStyle = (active) => ({
    padding: '8px 20px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--bg3)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? '#fff' : 'var(--muted)',
  });

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <button style={tabStyle(tab === 'journal')} onClick={() => setTab('journal')}>Trade Journal</button>
        <button style={tabStyle(tab === 'pp')} onClick={() => setTab('pp')}>PP Trade</button>
      </div>
      {msg && (
        <div style={{ background: '#22c55e22', border: '1px solid var(--green)', borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', color: 'var(--green)', fontSize: '13px' }}>
          {msg}
        </div>
      )}
      {tab === 'journal' ? <JournalForm onSaved={setMsg} /> : <PPForm onSaved={setMsg} />}
    </div>
  );
}
