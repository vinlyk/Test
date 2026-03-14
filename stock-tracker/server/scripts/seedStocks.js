/**
 * Seed script: Stocks.xlsx data
 * Reads from server/data/stocks.json (pre-exported from Excel)
 * or falls back to hardcoded sample rows.
 *
 * Rows with qty > 0 → positions table
 * Rows with qty = 0 → watchlist table
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../db');

// SGD-denominated stock codes
const SGD_CODES = new Set(['D05', 'U11', 'O39']);

function parseSupportLevels(row) {
  const levels = [row.support1, row.support2, row.support3, row.support4]
    .map(v => (v != null && v !== '' ? parseFloat(v) : null))
    .filter(v => v != null && !isNaN(v));
  return JSON.stringify(levels);
}

function parseIntrinsicValue(val) {
  if (!val) return null;
  return String(val).trim();
}

function loadData() {
  // Try loading from a JSON file first
  const jsonPath = path.join(__dirname, '../data/stocks.json');
  try {
    return require(jsonPath);
  } catch {
    return getHardcodedData();
  }
}

function getHardcodedData() {
  // Active holdings and watchlist from Stocks.xlsx (deduplicated)
  return [
    // Active holdings (qty > 0)
    { code: 'AMZN',  name: 'Amazon',            category: 'Tech',          qty: 155,  price: null, avg_cost: null, support1: 185, support2: 178, support3: 170, support4: 160, intrinsic_value: '250/220' },
    { code: 'GOOGL', name: 'Alphabet',           category: 'Communications',qty: 250,  price: null, avg_cost: null, support1: 165, support2: 158, support3: 150, support4: 140, intrinsic_value: '200/185' },
    { code: 'META',  name: 'Meta Platforms',     category: 'Communications',qty: 35,   price: null, avg_cost: null, support1: 520, support2: 490, support3: 460, support4: 430, intrinsic_value: '600/550' },
    { code: 'MSFT',  name: 'Microsoft',          category: 'Tech',          qty: 50,   price: null, avg_cost: null, support1: 385, support2: 370, support3: 355, support4: 340, intrinsic_value: '450/420' },
    { code: 'NVDA',  name: 'Nvidia',             category: 'Tech',          qty: 110,  price: null, avg_cost: null, support1: 110, support2: 100, support3: 90,  support4: 80,  intrinsic_value: '140/120' },
    { code: 'PLTR',  name: 'Palantir',           category: 'Tech',          qty: 400,  price: null, avg_cost: null, support1: 70,  support2: 60,  support3: 55,  support4: 50,  intrinsic_value: '85/75' },
    { code: 'HIMS',  name: 'Hims & Hers',        category: 'Healthcare',    qty: 50,   price: null, avg_cost: null, support1: 22,  support2: 18,  support3: 15,  support4: 12,  intrinsic_value: null },
    { code: 'WM',    name: 'Waste Management',   category: 'Consumer',      qty: 20,   price: null, avg_cost: null, support1: 190, support2: 180, support3: 170, support4: 160, intrinsic_value: '220/200' },
    { code: 'UNH',   name: 'UnitedHealth',       category: 'Healthcare',    qty: 25,   price: null, avg_cost: null, support1: 460, support2: 440, support3: 420, support4: 400, intrinsic_value: '550/500' },
    { code: 'NOW',   name: 'ServiceNow',         category: 'SaaS',          qty: 40,   price: null, avg_cost: null, support1: 800, support2: 750, support3: 700, support4: 650, intrinsic_value: '950/900' },
    { code: 'NVO',   name: 'Novo Nordisk',       category: 'Healthcare',    qty: 50,   price: null, avg_cost: null, support1: 75,  support2: 68,  support3: 62,  support4: 55,  intrinsic_value: null },
    { code: 'D05',   name: 'DBS Group',          category: 'Financial',     qty: 200,  price: null, avg_cost: null, support1: 32,  support2: 30,  support3: 28,  support4: 25,  intrinsic_value: null },
    { code: 'U11',   name: 'UOB',                category: 'Financial',     qty: 200,  price: null, avg_cost: null, support1: 28,  support2: 26,  support3: 24,  support4: 22,  intrinsic_value: null },
    { code: 'O39',   name: 'OCBC',               category: 'Financial',     qty: 100,  price: null, avg_cost: null, support1: 14,  support2: 13,  support3: 12,  support4: 11,  intrinsic_value: null },
    { code: 'CIBR',  name: 'First Trust Cyber',  category: 'Security',      qty: 60,   price: null, avg_cost: null, support1: 58,  support2: 54,  support3: 50,  support4: 46,  intrinsic_value: null },
    { code: 'AIPO',  name: 'Renaissance IPO',    category: 'Tech',          qty: 50,   price: null, avg_cost: null, support1: 28,  support2: 25,  support3: 22,  support4: 19,  intrinsic_value: null },
    { code: 'SHLD',  name: 'Global X Defense',   category: 'Security',      qty: 20,   price: null, avg_cost: null, support1: 32,  support2: 30,  support3: 28,  support4: 25,  intrinsic_value: null },
    // Watchlist (qty = 0)
    { code: 'AAPL',  name: 'Apple',              category: 'Tech',          qty: 0,    price: null, avg_cost: null, support1: 190, support2: 180, support3: 170, support4: 160, intrinsic_value: '220/200' },
    { code: 'TSLA',  name: 'Tesla',              category: 'Tech',          qty: 0,    price: null, avg_cost: null, support1: 250, support2: 230, support3: 210, support4: 190, intrinsic_value: null },
    { code: 'AVGO',  name: 'Broadcom',           category: 'Tech',          qty: 0,    price: null, avg_cost: null, support1: 185, support2: 175, support3: 165, support4: 155, intrinsic_value: null },
    { code: 'FTNT',  name: 'Fortinet',           category: 'Security',      qty: 0,    price: null, avg_cost: null, support1: 82,  support2: 76,  support3: 70,  support4: 64,  intrinsic_value: null },
    { code: 'PANW',  name: 'Palo Alto Networks', category: 'Security',      qty: 0,    price: null, avg_cost: null, support1: 175, support2: 165, support3: 155, support4: 145, intrinsic_value: null },
    { code: 'AMD',   name: 'AMD',                category: 'Tech',          qty: 0,    price: null, avg_cost: null, support1: 110, support2: 100, support3: 90,  support4: 80,  intrinsic_value: null },
    { code: 'WMT',   name: 'Walmart',            category: 'Consumer',      qty: 0,    price: null, avg_cost: null, support1: 88,  support2: 82,  support3: 76,  support4: 70,  intrinsic_value: null },
    { code: 'COIN',  name: 'Coinbase',           category: 'Crypto',        qty: 0,    price: null, avg_cost: null, support1: 180, support2: 160, support3: 140, support4: 120, intrinsic_value: null },
    { code: 'IBIT',  name: 'iShares Bitcoin ETF',category: 'BitCoin',       qty: 0,    price: null, avg_cost: null, support1: 48,  support2: 44,  support3: 40,  support4: 36,  intrinsic_value: null },
  ];
}

function seed() {
  const rows = loadData();

  // Deduplicate by code
  const seen = new Set();
  const unique = rows.filter(r => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });

  const insertPosition = db.prepare(`
    INSERT OR REPLACE INTO positions
      (symbol, underlying, position_type, category, quantity, avg_cost, currency,
       support_levels, intrinsic_value, strategy_type, realized_pnl)
    VALUES
      (@symbol, @underlying, 'stock', @category, @quantity, @avg_cost, @currency,
       @support_levels, @intrinsic_value, NULL, 0)
  `);

  const insertWatchlist = db.prepare(`
    INSERT OR REPLACE INTO watchlist
      (symbol, name, category, avg_cost, support_levels, intrinsic_value, currency)
    VALUES
      (@symbol, @name, @category, @avg_cost, @support_levels, @intrinsic_value, @currency)
  `);

  const seedAll = db.transaction(() => {
    let positions = 0, watchlist = 0;
    for (const row of unique) {
      const currency = SGD_CODES.has(row.code) ? 'SGD' : 'USD';
      const support_levels = parseSupportLevels(row);
      const intrinsic_value = parseIntrinsicValue(row.intrinsic_value);

      if (row.qty > 0) {
        insertPosition.run({
          symbol: row.code,
          underlying: row.code,
          category: row.category || null,
          quantity: row.qty,
          avg_cost: row.avg_cost ?? 0,
          currency,
          support_levels,
          intrinsic_value,
        });
        positions++;
      } else {
        insertWatchlist.run({
          symbol: row.code,
          name: row.name || null,
          category: row.category || null,
          avg_cost: row.avg_cost ?? null,
          currency,
          support_levels,
          intrinsic_value,
        });
        watchlist++;
      }
    }
    return { positions, watchlist };
  });

  const result = seedAll();
  console.log(`Seeded ${result.positions} positions, ${result.watchlist} watchlist items.`);
}

seed();
