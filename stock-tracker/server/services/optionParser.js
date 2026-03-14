/**
 * Option symbol parsers for OCC and OPRA formats.
 *
 * OCC format:  AMZN260320C217500
 *   [1-5 letters][YYMMDD][C/P][strike * 1000, zero-padded to 8 digits]
 *   strike = last digits / 1000  (217500 → 217.50)
 *
 * OPRA format: .AMZN250926C230
 *   .[1-6 letters][YYMMDD][C/P][integer or decimal strike]
 *   strike = integer dollar amount  (230 → 230.00)
 */

const OCC_REGEX = /^([A-Z]{1,5})(\d{6})([CP])(\d+)$/;
const OPRA_REGEX = /^\.([A-Z]{1,6})(\d{6})([CP])(\d+(?:\.\d+)?)$/;

function _parseDate(yymmdd) {
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const fullYear = parseInt(yy, 10) >= 50 ? `19${yy}` : `20${yy}`;
  return `${fullYear}-${mm}-${dd}`;
}

/**
 * Parse an OCC option symbol.
 * Returns null if the symbol doesn't match.
 */
function parseOCC(symbol) {
  if (!symbol) return null;
  const m = symbol.toUpperCase().match(OCC_REGEX);
  if (!m) return null;
  return {
    underlying: m[1],
    expiry: _parseDate(m[2]),
    type: m[3],
    strike: parseInt(m[4], 10) / 1000,
    format: 'OCC',
    raw: symbol,
  };
}

/**
 * Parse an OPRA option symbol (leading dot).
 * Returns null if the symbol doesn't match.
 */
function parseOPRA(symbol) {
  if (!symbol) return null;
  const m = symbol.toUpperCase().match(OPRA_REGEX);
  if (!m) return null;
  return {
    underlying: m[1],
    expiry: _parseDate(m[2]),
    type: m[3],
    strike: parseFloat(m[4]),
    format: 'OPRA',
    raw: symbol,
  };
}

/**
 * Parse either OCC or OPRA. Returns null if neither matches.
 */
function parseOptionSymbol(symbol) {
  return parseOCC(symbol) || parseOPRA(symbol);
}

/**
 * Returns true if the string looks like an OPRA symbol.
 */
function isOPRA(symbol) {
  return symbol && OPRA_REGEX.test(symbol.toUpperCase());
}

/**
 * Returns true if the string looks like an OCC symbol.
 */
function isOCC(symbol) {
  return symbol && OCC_REGEX.test(symbol.toUpperCase());
}

module.exports = { parseOCC, parseOPRA, parseOptionSymbol, isOPRA, isOCC };
