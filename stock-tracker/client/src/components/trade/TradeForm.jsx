import { useForm } from 'react-hook-form';
import { positions as positionsApi } from '../../api/client';
import { parseOCC } from '../../utils/optionSymbol';

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal = {
  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px',
  padding: '28px', width: '480px', maxWidth: '95vw',
};
const inputStyle = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: '6px', color: 'var(--text)', padding: '8px 10px', fontSize: '13px',
};
const label = { display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase' };
const field = { marginBottom: '14px' };

export default function TradeForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: initial ?? {
      position_type: 'stock',
      currency: 'USD',
      realized_pnl: 0,
    },
  });

  const posType = watch('position_type');
  const symbol = watch('symbol');

  // Auto-fill underlying from OCC symbol
  const parsedOption = posType !== 'stock' && symbol ? parseOCC(symbol) : null;

  const onSubmit = async (data) => {
    // Derive underlying + option fields from OCC symbol if option
    if (posType !== 'stock' && parsedOption) {
      data.underlying = data.underlying || parsedOption.underlying;
      data.expiry_date = data.expiry_date || parsedOption.expiry;
      data.strike_price = data.strike_price || parsedOption.strike;
      data.option_type = parsedOption.type;
    } else if (posType === 'stock') {
      data.underlying = data.underlying || data.symbol;
    }

    try {
      if (isEdit) {
        await positionsApi.update(initial.id, data);
      } else {
        await positionsApi.create(data);
      }
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>{isEdit ? 'Edit Position' : 'Add Position'}</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={field}>
            <label style={label}>Type</label>
            <select {...register('position_type')} style={inputStyle}>
              <option value="stock">Stock</option>
              <option value="call">Call Option</option>
              <option value="put">Put Option</option>
            </select>
          </div>
          <div style={field}>
            <label style={label}>Symbol {posType !== 'stock' ? '(OCC format, e.g. AMZN260320C217500)' : ''}</label>
            <input {...register('symbol', { required: true })} style={inputStyle} placeholder={posType === 'stock' ? 'AAPL' : 'AMZN260320C217500'} />
          </div>
          {posType === 'stock' && (
            <div style={field}>
              <label style={label}>Underlying (if different)</label>
              <input {...register('underlying')} style={inputStyle} placeholder="same as symbol" />
            </div>
          )}
          {parsedOption && (
            <div style={{ ...field, fontSize: '12px', color: 'var(--accent2)', background: 'var(--bg3)', padding: '8px', borderRadius: '6px' }}>
              Parsed: {parsedOption.underlying} {parsedOption.expiry} {parsedOption.type === 'C' ? 'Call' : 'Put'} ${parsedOption.strike}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={field}>
              <label style={label}>Quantity</label>
              <input type="number" step="any" {...register('quantity', { required: true, valueAsNumber: true })} style={inputStyle} />
            </div>
            <div style={field}>
              <label style={label}>Avg Cost</label>
              <input type="number" step="any" {...register('avg_cost', { required: true, valueAsNumber: true })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={field}>
              <label style={label}>Strategy Type</label>
              <select {...register('strategy_type')} style={inputStyle}>
                <option value="">— none —</option>
                <option value="standalone">Standalone</option>
                <option value="covered">Covered</option>
                <option value="diagonal">Diagonal</option>
                <option value="vertical">Vertical</option>
                <option value="calendar">Calendar</option>
              </select>
            </div>
            <div style={field}>
              <label style={label}>Currency</label>
              <select {...register('currency')} style={inputStyle}>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
              </select>
            </div>
          </div>
          {posType !== 'stock' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={field}>
                  <label style={label}>Expiry Date</label>
                  <input type="date" {...register('expiry_date')} style={inputStyle} />
                </div>
                <div style={field}>
                  <label style={label}>Strike Price</label>
                  <input type="number" step="any" {...register('strike_price', { valueAsNumber: true })} style={inputStyle} />
                </div>
              </div>
            </>
          )}
          <div style={field}>
            <label style={label}>Notes</label>
            <input {...register('notes')} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ ...inputStyle, width: 'auto', padding: '8px 16px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: '6px', color: '#fff', padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}
            >
              {isSubmitting ? 'Saving…' : isEdit ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
