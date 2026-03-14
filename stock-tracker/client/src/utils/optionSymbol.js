// Client-side option symbol utilities (mirrors server/services/optionParser.js)

export function parseOCC(symbol) {
  if (!symbol) return null;
  const m = symbol.toUpperCase().match(/^([A-Z]{1,5})(\d{6})([CP])(\d+)$/);
  if (!m) return null;
  const [, underlying, yymmdd, type, strikePart] = m;
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const fullYear = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
  return {
    underlying,
    expiry: `${fullYear}-${mm}-${dd}`,
    type,
    strike: parseInt(strikePart, 10) / 1000,
  };
}

export function parseOPRA(symbol) {
  if (!symbol) return null;
  const m = symbol.toUpperCase().match(/^\.([A-Z]{1,6})(\d{6})([CP])(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const [, underlying, yymmdd, type, strikePart] = m;
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const fullYear = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
  return {
    underlying,
    expiry: `${fullYear}-${mm}-${dd}`,
    type,
    strike: parseFloat(strikePart),
  };
}

export function isOption(symbol) {
  return parseOCC(symbol) !== null || parseOPRA(symbol) !== null;
}

export function symbolLabel(symbol) {
  const occ = parseOCC(symbol);
  if (occ) return `${occ.underlying} ${occ.expiry} ${occ.type === 'C' ? 'Call' : 'Put'} $${occ.strike}`;
  const opra = parseOPRA(symbol);
  if (opra) return `${opra.underlying} ${opra.expiry} ${opra.type === 'C' ? 'Call' : 'Put'} $${opra.strike}`;
  return symbol;
}
