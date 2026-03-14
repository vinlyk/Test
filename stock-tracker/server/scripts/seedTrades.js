/**
 * Seed script: User's own TOS Trade Journal (464 rows)
 * Reads from server/data/trades.json (pre-exported from Excel/Google Sheets)
 *
 * Columns: symbol, name, strategy, stock_price, strike, call_price, put_price,
 *          order_price, dte_days, bought_date, closed_date, max_profit, max_loss,
 *          profit_ratio, contracts_bought, pl
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../db');

// Strip Google Finance IFERROR formulas: =IFERROR(GOOGLEFINANCE(...),"COMPANY NAME")
// Extracts the fallback "COMPANY NAME" portion
function cleanName(raw) {
  if (!raw) return null;
  const m = String(raw).match(/IFERROR\(.*?,\s*"([^"]+)"\s*\)/);
  if (m) return m[1].trim();
  // If it's still a formula fragment, just use empty
  if (String(raw).startsWith('=')) return null;
  return String(raw).trim() || null;
}

// Normalize strategy name to a canonical form
const STRATEGY_MAP = {
  'covered call': 'Covered Call', 'cc': 'Covered Call',
  'csp': 'CSP', 'cash secured put': 'CSP', 'cash-secured put': 'CSP',
  'bull put spread': 'BPS', 'bps': 'BPS',
  'bcs': 'BCS', 'bucs': 'BCS', 'bull call spread': 'BCS',
  'bs': 'BS', 'bull spread': 'BS',
  'bb': 'BB', 'bull bang': 'BB',
  'bbc': 'BBC',
  'cbs': 'CBS',
  'ds hammer': 'DS Hammer', 'ds_hammer': 'DS Hammer',
  'calendar spread': 'Calendar Spread', 'calendar': 'Calendar Spread',
  'iron condor': 'Iron Condor', 'ic': 'Iron Condor',
  'eps': 'EPS',
  'ess': 'ESS',
  'leap': 'Leap',
  'butterfly': 'Butterfly',
};

function normalizeStrategy(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().trim();
  return STRATEGY_MAP[key] || String(raw).trim();
}

// Parse closed_date: treat "?", "???", "Closed", "Unknown", empty → NULL
function parseClosedDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (['?', '??', '???', 'closed', 'unknown', 'n/a', ''].includes(s.toLowerCase())) return null;
  // If looks like a date (has digits), keep it
  if (/\d{4}/.test(s)) return s;
  return null;
}

// Parse numeric, handle string "$123.45" or formulas
function parseNum(val) {
  if (val == null || val === '') return null;
  const s = String(val).replace(/[$,\s]/g, '');
  if (s.startsWith('=')) return null; // Excel formula
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Skip rows that are not actual trades
const SKIP_KEYWORDS = ['total p/l', 'csp should aim', 'note:', 'important:'];
function shouldSkip(row) {
  const sym = String(row.symbol || '').toLowerCase();
  return SKIP_KEYWORDS.some(k => sym.includes(k));
}

function loadData() {
  const jsonPath = path.join(__dirname, '../data/trades.json');
  try { return require(jsonPath); } catch { return []; }
}

function seed() {
  const rows = loadData();
  if (rows.length === 0) {
    console.log('No trades.json found. Skipping trade journal seed.');
    console.log('To seed, place your trades data as server/data/trades.json');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO trades
      (symbol, name, strategy, stock_price, strike, call_price, put_price,
       order_price, expiry_date, bought_date, closed_date, max_profit,
       max_loss, profit_ratio, contracts, pl, notes)
    VALUES
      (@symbol, @name, @strategy, @stock_price, @strike, @call_price, @put_price,
       @order_price, @expiry_date, @bought_date, @closed_date, @max_profit,
       @max_loss, @profit_ratio, @contracts, @pl, @notes)
  `);

  const seedAll = db.transaction(() => {
    let count = 0;
    for (const row of rows) {
      if (shouldSkip(row)) continue;
      if (!row.symbol || String(row.symbol).trim() === '') continue;

      insert.run({
        symbol:       String(row.symbol).trim().toUpperCase(),
        name:         cleanName(row.name),
        strategy:     normalizeStrategy(row.strategy),
        stock_price:  parseNum(row.stock_price),
        strike:       row.strike ? String(row.strike).trim() : null,
        call_price:   row.call_price ? String(row.call_price).trim() : null,
        put_price:    row.put_price ? String(row.put_price).trim() : null,
        order_price:  parseNum(row.order_price),
        expiry_date:  null, // computed from DTE at runtime if needed
        bought_date:  row.bought_date ? String(row.bought_date).trim() : null,
        closed_date:  parseClosedDate(row.closed_date),
        max_profit:   parseNum(row.max_profit),
        max_loss:     parseNum(row.max_loss),
        profit_ratio: parseNum(row.profit_ratio),
        contracts:    parseNum(row.contracts_bought) ?? 1,
        pl:           parseNum(row.pl),
        notes:        null,
      });
      count++;
    }
    return count;
  });

  const count = seedAll();
  console.log(`Seeded ${count} trades into trade journal.`);
}

seed();
