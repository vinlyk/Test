export function fmtCurrency(val, currency = 'USD', decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function fmtNumber(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function fmtPercent(val, decimals = 2) {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(decimals)}%`;
}

export function fmtPnl(val, currency = 'USD') {
  if (val == null || isNaN(val)) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${fmtCurrency(val, currency)}`;
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return dateStr.slice(0, 10);
}

export function pnlColor(val) {
  if (val == null) return 'inherit';
  return val >= 0 ? 'var(--green)' : 'var(--red)';
}
