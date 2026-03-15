/**
 * Master seed script for ~/Documents/stock-tracker
 *
 * Reads from ~/Documents/Claude/Scheduled/Trading/:
 *   stocks_data.csv   → positions (qty > 0) + watchlist (qty = 0)
 *   options_data.csv  → pp_trades (options log)
 *   tos_trades.csv    → trades (TOS tracker)
 *   trading_data.json → supplemental / override data
 *
 * Falls back to hardcoded sample data if the files are not found.
 */

const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../db');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const TRADING_DIR = path.join(process.env.HOME || '/root', 'Documents', 'Claude', 'Scheduled', 'Trading');

function readCsv(filename) {
  const fp = path.join(TRADING_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

function readJson(filename) {
  const fp = path.join(TRADING_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function pn(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[$,%\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function cleanDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || ['?','??','???','closed','unknown','n/a'].includes(s.toLowerCase())) return null;
  if (/\d{4}/.test(s)) return s.slice(0,10);
  return null;
}

// ---------------------------------------------------------------------------
// SGD symbols
// ---------------------------------------------------------------------------
const SGD_CODES = new Set(['D05','U11','O39']);

function parseSupportLevels(row) {
  const vals = ['support1','support2','support3','support4'].map(k => pn(row[k])).filter(n => n != null);
  return JSON.stringify(vals);
}

// ---------------------------------------------------------------------------
// SEED STOCKS / WATCHLIST
// ---------------------------------------------------------------------------
function seedStocks() {
  console.log('\n── Seeding stocks / watchlist ──');
  let rows = readCsv('stocks_data.csv');

  if (!rows) {
    console.log('  stocks_data.csv not found — using hardcoded data');
    rows = getHardcodedStocks();
  } else {
    console.log(`  Loaded ${rows.length} rows from stocks_data.csv`);
  }

  const insertPos = db.prepare(`
    INSERT OR REPLACE INTO positions
      (symbol, underlying, position_type, category, quantity, avg_cost, currency,
       support_levels, intrinsic_value, strategy_type, realized_pnl)
    VALUES
      (@symbol, @underlying, 'stock', @category, @quantity, @avg_cost, @currency,
       @support_levels, @intrinsic_value, NULL, 0)
  `);
  const insertWL = db.prepare(`
    INSERT OR REPLACE INTO watchlist
      (symbol, name, category, avg_cost, support_levels, intrinsic_value, currency)
    VALUES
      (@symbol, @name, @category, @avg_cost, @support_levels, @intrinsic_value, @currency)
  `);

  let nPos = 0, nWL = 0;
  const seen = new Set();
  db.transaction(() => {
    for (const row of rows) {
      const code = (row.code || row.symbol || '').trim().toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const qty = pn(row.qty ?? row.quantity) ?? 0;
      const currency = SGD_CODES.has(code) ? 'SGD' : (row.currency || 'USD');
      const sl = parseSupportLevels(row);
      const iv = row.intrinsic_value ? String(row.intrinsic_value).trim() : null;
      if (qty > 0) {
        insertPos.run({ symbol: code, underlying: code, category: row.category || null,
          quantity: qty, avg_cost: pn(row.avg_cost) ?? 0, currency, support_levels: sl, intrinsic_value: iv });
        nPos++;
      } else {
        insertWL.run({ symbol: code, name: row.name || null, category: row.category || null,
          avg_cost: pn(row.avg_cost), currency, support_levels: sl, intrinsic_value: iv });
        nWL++;
      }
    }
  })();
  console.log(`  → ${nPos} positions, ${nWL} watchlist items`);
}

// ---------------------------------------------------------------------------
// SEED TOS TRADES
// ---------------------------------------------------------------------------
function seedTosTrades() {
  console.log('\n── Seeding TOS trades ──');
  let rows = readCsv('tos_trades.csv');

  if (!rows) {
    const json = readJson('trading_data.json');
    if (json?.trades) { rows = json.trades; console.log(`  Loaded ${rows.length} rows from trading_data.json → trades`); }
    else { rows = getHardcodedTrades(); console.log('  No tos_trades.csv — using hardcoded data'); }
  } else {
    console.log(`  Loaded ${rows.length} rows from tos_trades.csv`);
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

  let n = 0;
  db.transaction(() => {
    for (const row of rows) {
      const sym = (row.symbol || '').trim().toUpperCase();
      if (!sym || sym.startsWith('TOTAL') || sym.startsWith('NOTE')) continue;
      insert.run({
        symbol:       sym,
        name:         row.name ? String(row.name).trim() : null,
        strategy:     row.strategy ? String(row.strategy).trim() : null,
        stock_price:  pn(row.stock_price),
        strike:       row.strike ? String(row.strike).trim() : null,
        call_price:   row.call_price ? String(row.call_price).trim() : null,
        put_price:    row.put_price ? String(row.put_price).trim() : null,
        order_price:  pn(row.order_price),
        expiry_date:  null,
        bought_date:  cleanDate(row.bought_date ?? row.date),
        closed_date:  cleanDate(row.closed_date),
        max_profit:   pn(row.max_profit),
        max_loss:     pn(row.max_loss),
        profit_ratio: pn(row.profit_ratio),
        contracts:    pn(row.contracts ?? row.contracts_bought) ?? 1,
        pl:           pn(row.pl),
        notes:        row.notes ? String(row.notes).trim() : null,
      });
      n++;
    }
  })();
  console.log(`  → ${n} TOS trades`);
}

// ---------------------------------------------------------------------------
// SEED OPTIONS (PP Trades / Options Log)
// ---------------------------------------------------------------------------
function seedOptions() {
  console.log('\n── Seeding options log ──');
  let rows = readCsv('options_data.csv');

  if (!rows) {
    const json = readJson('trading_data.json');
    if (json?.options || json?.pp_trades) {
      rows = json.options ?? json.pp_trades;
      console.log(`  Loaded ${rows.length} rows from trading_data.json → options`);
    } else {
      rows = getHardcodedPPTrades();
      console.log('  No options_data.csv — using hardcoded data');
    }
  } else {
    console.log(`  Loaded ${rows.length} rows from options_data.csv`);
  }

  const { parseOPRA, isOPRA } = require('../services/optionParser');

  const insert = db.prepare(`
    INSERT INTO pp_trades
      (trade_no, strategy, strategy_variant,
       leg1_symbol, leg1_underlying, leg1_expiry, leg1_type, leg1_strike,
       leg2_symbol, leg2_underlying, leg2_expiry, leg2_type, leg2_strike,
       entry_date, qty_leg1, entry_price_leg1, spread_leg1,
       dte, entry_value, capital_bp, max_loss, rolling_pl)
    VALUES
      (@trade_no, @strategy, @strategy_variant,
       @leg1_symbol, @leg1_underlying, @leg1_expiry, @leg1_type, @leg1_strike,
       @leg2_symbol, @leg2_underlying, @leg2_expiry, @leg2_type, @leg2_strike,
       @entry_date, @qty_leg1, @entry_price_leg1, @spread_leg1,
       @dte, @entry_value, @capital_bp, @max_loss, @rolling_pl)
  `);

  function isNumTradeNo(v) { return v != null && /^\d+$/.test(String(v).trim()); }
  function normalizeStrat(s) {
    if (!s) return null;
    const str = String(s).trim().toUpperCase();
    return str === 'CROUNCHING' ? 'CROUCHING' : str;
  }

  let n = 0;
  db.transaction(() => {
    for (const raw of rows) {
      if (!isNumTradeNo(raw.trade_no)) continue;
      if (raw.strategy_variant && String(raw.strategy_variant).includes('Switch to the previous')) continue;

      let strat = raw.strategy;
      let leg1  = raw.opra_leg1 ?? raw.leg1_symbol;
      if (leg1 && isOPRA(strat) && !isOPRA(leg1)) { [strat, leg1] = [leg1, strat]; }

      let leg2 = null, stratVariant = raw.strategy_variant ?? null;
      if (stratVariant && isOPRA(stratVariant)) { leg2 = stratVariant; stratVariant = null; }
      if (raw.leg2_symbol) leg2 = raw.leg2_symbol;

      const p1 = leg1 ? parseOPRA(leg1) : null;
      const p2 = leg2 ? parseOPRA(leg2) : null;

      insert.run({
        trade_no:         parseInt(raw.trade_no, 10),
        strategy:         normalizeStrat(strat),
        strategy_variant: stratVariant,
        leg1_symbol:      leg1 ?? null,
        leg1_underlying:  p1?.underlying ?? null,
        leg1_expiry:      p1?.expiry ?? null,
        leg1_type:        p1?.type ?? null,
        leg1_strike:      p1?.strike ?? null,
        leg2_symbol:      leg2 ?? null,
        leg2_underlying:  p2?.underlying ?? null,
        leg2_expiry:      p2?.expiry ?? null,
        leg2_type:        p2?.type ?? null,
        leg2_strike:      p2?.strike ?? null,
        entry_date:       raw.entry_date ?? null,
        qty_leg1:         pn(raw.qty_leg1),
        entry_price_leg1: pn(raw.entry_price_leg1),
        spread_leg1:      pn(raw.spread_leg1),
        dte:              pn(raw.dte),
        entry_value:      pn(raw.entry_value),
        capital_bp:       pn(raw.capital_bp),
        max_loss:         pn(raw.max_loss),
        rolling_pl:       pn(raw.rolling_pl),
      });
      n++;
    }
  })();
  console.log(`  → ${n} options trades`);
}

// ---------------------------------------------------------------------------
// HARDCODED FALLBACK DATA
// ---------------------------------------------------------------------------
function getHardcodedStocks() {
  return [
    { code:'AMZN',  name:'Amazon',              category:'Tech',           qty:155,  avg_cost:185,  support1:185, support2:178, support3:170, support4:160, intrinsic_value:'250/220' },
    { code:'GOOGL', name:'Alphabet',             category:'Communications', qty:250,  avg_cost:162,  support1:165, support2:158, support3:150, support4:140, intrinsic_value:'200/185' },
    { code:'META',  name:'Meta Platforms',       category:'Communications', qty:35,   avg_cost:510,  support1:520, support2:490, support3:460, support4:430, intrinsic_value:'600/550' },
    { code:'MSFT',  name:'Microsoft',            category:'Tech',           qty:50,   avg_cost:380,  support1:385, support2:370, support3:355, support4:340, intrinsic_value:'450/420' },
    { code:'NVDA',  name:'Nvidia',               category:'Tech',           qty:110,  avg_cost:108,  support1:110, support2:100, support3:90,  support4:80,  intrinsic_value:'140/120' },
    { code:'PLTR',  name:'Palantir',             category:'Tech',           qty:400,  avg_cost:68,   support1:70,  support2:60,  support3:55,  support4:50,  intrinsic_value:'85/75'  },
    { code:'HIMS',  name:'Hims & Hers',          category:'Healthcare',     qty:50,   avg_cost:20,   support1:22,  support2:18,  support3:15,  support4:12,  intrinsic_value:null     },
    { code:'WM',    name:'Waste Management',     category:'Consumer',       qty:20,   avg_cost:188,  support1:190, support2:180, support3:170, support4:160, intrinsic_value:'220/200' },
    { code:'UNH',   name:'UnitedHealth',         category:'Healthcare',     qty:25,   avg_cost:458,  support1:460, support2:440, support3:420, support4:400, intrinsic_value:'550/500' },
    { code:'NOW',   name:'ServiceNow',           category:'SaaS',           qty:40,   avg_cost:798,  support1:800, support2:750, support3:700, support4:650, intrinsic_value:'950/900' },
    { code:'NVO',   name:'Novo Nordisk',         category:'Healthcare',     qty:50,   avg_cost:73,   support1:75,  support2:68,  support3:62,  support4:55,  intrinsic_value:null     },
    { code:'D05',   name:'DBS Group',            category:'Financial',      qty:200,  avg_cost:31,   support1:32,  support2:30,  support3:28,  support4:25,  intrinsic_value:null     },
    { code:'U11',   name:'UOB',                  category:'Financial',      qty:200,  avg_cost:27,   support1:28,  support2:26,  support3:24,  support4:22,  intrinsic_value:null     },
    { code:'O39',   name:'OCBC',                 category:'Financial',      qty:100,  avg_cost:13.5, support1:14,  support2:13,  support3:12,  support4:11,  intrinsic_value:null     },
    { code:'CIBR',  name:'First Trust Cyber ETF',category:'Security',       qty:60,   avg_cost:56,   support1:58,  support2:54,  support3:50,  support4:46,  intrinsic_value:null     },
    { code:'SHLD',  name:'Global X Defense ETF', category:'Security',       qty:20,   avg_cost:31,   support1:32,  support2:30,  support3:28,  support4:25,  intrinsic_value:null     },
    // Watchlist
    { code:'AAPL',  name:'Apple',                category:'Tech',           qty:0, support1:190, support2:180, support3:170, support4:160, intrinsic_value:'220/200' },
    { code:'TSLA',  name:'Tesla',                category:'Tech',           qty:0, support1:250, support2:230, support3:210, support4:190, intrinsic_value:null     },
    { code:'AVGO',  name:'Broadcom',             category:'Tech',           qty:0, support1:185, support2:175, support3:165, support4:155, intrinsic_value:null     },
    { code:'FTNT',  name:'Fortinet',             category:'Security',       qty:0, support1:82,  support2:76,  support3:70,  support4:64,  intrinsic_value:null     },
    { code:'PANW',  name:'Palo Alto Networks',   category:'Security',       qty:0, support1:175, support2:165, support3:155, support4:145, intrinsic_value:null     },
    { code:'AMD',   name:'AMD',                  category:'Tech',           qty:0, support1:110, support2:100, support3:90,  support4:80,  intrinsic_value:null     },
    { code:'WMT',   name:'Walmart',              category:'Consumer',       qty:0, support1:88,  support2:82,  support3:76,  support4:70,  intrinsic_value:null     },
    { code:'COIN',  name:'Coinbase',             category:'Crypto',         qty:0, support1:180, support2:160, support3:140, support4:120, intrinsic_value:null     },
    { code:'IBIT',  name:'iShares Bitcoin ETF',  category:'Crypto',         qty:0, support1:48,  support2:44,  support3:40,  support4:36,  intrinsic_value:null     },
  ];
}

function getHardcodedTrades() {
  return [
    { symbol:'AMZN', name:'Amazon',      strategy:'CSP',           stock_price:188, strike:'185',       order_price:3.2,  bought_date:'2025-01-08', closed_date:'2025-01-22', max_profit:320, max_loss:18500, contracts:1, pl:320  },
    { symbol:'MSFT', name:'Microsoft',   strategy:'Covered Call',  stock_price:383, strike:'390',       order_price:5.1,  bought_date:'2025-01-10', closed_date:'2025-01-31', max_profit:510, max_loss:null,  contracts:1, pl:510  },
    { symbol:'NVDA', name:'Nvidia',      strategy:'BPS',           stock_price:112, strike:'105/100',   order_price:1.8,  bought_date:'2025-01-14', closed_date:'2025-01-28', max_profit:180, max_loss:320,   contracts:2, pl:180  },
    { symbol:'GOOGL', name:'Alphabet',   strategy:'CSP',           stock_price:165, strike:'160',       order_price:2.9,  bought_date:'2025-01-18', closed_date:null,          max_profit:290, max_loss:16000, contracts:1, pl:null },
    { symbol:'META',  name:'Meta',       strategy:'Covered Call',  stock_price:518, strike:'530',       order_price:8.5,  bought_date:'2025-01-20', closed_date:'2025-02-07', max_profit:850, max_loss:null,  contracts:1, pl:850  },
    { symbol:'PLTR',  name:'Palantir',   strategy:'Bull Call Spread',stock_price:72,'strike':'70/80',  order_price:3.1,  bought_date:'2025-01-22', closed_date:'2025-02-14', max_profit:690, max_loss:310,   contracts:2, pl:420  },
    { symbol:'AMZN',  name:'Amazon',     strategy:'BCS',           stock_price:195, strike:'195/205',   order_price:4.5,  bought_date:'2025-01-28', closed_date:null,          max_profit:450, max_loss:550,   contracts:1, pl:null },
    { symbol:'NVDA',  name:'Nvidia',     strategy:'CSP',           stock_price:105, strike:'100',       order_price:2.2,  bought_date:'2025-02-03', closed_date:'2025-02-18', max_profit:220, max_loss:10000, contracts:2, pl:220  },
    { symbol:'UNH',   name:'UnitedHealth',strategy:'CSP',          stock_price:465, strike:'455',       order_price:6.8,  bought_date:'2025-02-05', closed_date:'2025-02-20', max_profit:680, max_loss:45500, contracts:1, pl:680  },
    { symbol:'NOW',   name:'ServiceNow', strategy:'Covered Call',  stock_price:810, strike:'830',       order_price:12.0, bought_date:'2025-02-07', closed_date:null,          max_profit:1200,max_loss:null,  contracts:1, pl:null },
    { symbol:'MSFT',  name:'Microsoft',  strategy:'Iron Condor',   stock_price:378, strike:'360/365/395/400',order_price:2.8, bought_date:'2025-02-10', closed_date:'2025-02-28', max_profit:280, max_loss:220, contracts:2, pl:280 },
    { symbol:'GOOGL', name:'Alphabet',   strategy:'BPS',           stock_price:168, strike:'162/158',   order_price:1.5,  bought_date:'2025-02-12', closed_date:'2025-02-26', max_profit:150, max_loss:250,   contracts:2, pl:150  },
    { symbol:'META',  name:'Meta',       strategy:'CSP',           stock_price:525, strike:'515',       order_price:9.2,  bought_date:'2025-02-15', closed_date:null,          max_profit:920, max_loss:51500, contracts:1, pl:null },
    { symbol:'WM',    name:'Waste Mgmt', strategy:'Covered Call',  stock_price:195, strike:'200',       order_price:3.5,  bought_date:'2025-02-18', closed_date:'2025-03-07', max_profit:350, max_loss:null,  contracts:1, pl:350  },
    { symbol:'AMZN',  name:'Amazon',     strategy:'CSP',           stock_price:200, strike:'195',       order_price:4.1,  bought_date:'2025-02-20', closed_date:'2025-03-05', max_profit:410, max_loss:19500, contracts:1, pl:410  },
    { symbol:'PLTR',  name:'Palantir',   strategy:'CSP',           stock_price:68,  strike:'65',        order_price:1.9,  bought_date:'2025-02-24', closed_date:null,          max_profit:190, max_loss:6500,  contracts:3, pl:null },
    { symbol:'HIMS',  name:'Hims&Hers',  strategy:'CSP',           stock_price:21,  strike:'19',        order_price:0.85, bought_date:'2025-03-01', closed_date:'2025-03-12', max_profit:85,  max_loss:1900,  contracts:2, pl:85   },
    { symbol:'NVDA',  name:'Nvidia',     strategy:'Covered Call',  stock_price:115, strike:'120',       order_price:3.8,  bought_date:'2025-03-03', closed_date:null,          max_profit:380, max_loss:null,  contracts:1, pl:null },
    { symbol:'CIBR',  name:'First Trust Cyber',strategy:'CSP',     stock_price:57,  strike:'55',        order_price:0.9,  bought_date:'2025-03-05', closed_date:null,          max_profit:90,  max_loss:5500,  contracts:2, pl:null },
    { symbol:'MSFT',  name:'Microsoft',  strategy:'DS Hammer',     stock_price:385, strike:'380/390',   order_price:5.5,  bought_date:'2025-03-08', closed_date:null,          max_profit:550, max_loss:450,   contracts:1, pl:null },
  ];
}

function getHardcodedPPTrades() {
  return [
    { strategy:'LIZARD',   opra_leg1:'.SPXW250620P5400', entry_date:'2025-01-08', qty_leg1:-10, entry_price_leg1:45.0, spread_leg1:-450, trade_no:'1',  strategy_variant:'.SPXW250620P5350', dte:87,  entry_value:18000, capital_bp:8500,  max_loss:14500, rolling_pl:320  },
    { strategy:'WING',     opra_leg1:'.AMZN250926C230',  entry_date:'2025-01-10', qty_leg1:-10, entry_price_leg1:3.23, spread_leg1:-323, trade_no:'2',  strategy_variant:null,               dte:86,  entry_value:1500,  capital_bp:1177,  max_loss:570,   rolling_pl:null },
    { strategy:'CALENDAR', opra_leg1:'.WMT250829C105',   entry_date:'2025-01-14', qty_leg1:-5,  entry_price_leg1:1.8,  spread_leg1:-90,  trade_no:'3',  strategy_variant:'.WMT250919C105',   dte:50,  entry_value:800,   capital_bp:450,   max_loss:320,   rolling_pl:180  },
    { strategy:'BEAR CALL',opra_leg1:'.MSFT250919C420',  entry_date:'2025-01-18', qty_leg1:-3,  entry_price_leg1:4.5,  spread_leg1:-135, trade_no:'4',  strategy_variant:'.MSFT250919C430',  dte:69,  entry_value:2500,  capital_bp:1350,  max_loss:1200,  rolling_pl:-50  },
    { strategy:'IRON',     opra_leg1:'.SPY251017P540',   entry_date:'2025-01-22', qty_leg1:-2,  entry_price_leg1:8.2,  spread_leg1:-164, trade_no:'5',  strategy_variant:'.SPY251017C590',   dte:95,  entry_value:3800,  capital_bp:2100,  max_loss:1800,  rolling_pl:320  },
    { strategy:'(BB)',     opra_leg1:'.NVDA250919C130',  entry_date:'2025-01-28', qty_leg1:-4,  entry_price_leg1:6.1,  spread_leg1:-244, trade_no:'6',  strategy_variant:null,               dte:66,  entry_value:4200,  capital_bp:1800,  max_loss:1600,  rolling_pl:90   },
    { strategy:'COLLAR',   opra_leg1:'.GOOGL251017P165', entry_date:'2025-02-03', qty_leg1:-2,  entry_price_leg1:3.4,  spread_leg1:-85,  trade_no:'7',  strategy_variant:'.GOOGL251017C190', dte:93,  entry_value:1600,  capital_bp:900,   max_loss:750,   rolling_pl:-20  },
    { strategy:'(IC)',     opra_leg1:'.QQQ251121P470',   entry_date:'2025-02-07', qty_leg1:-1,  entry_price_leg1:12.4, spread_leg1:-186, trade_no:'8',  strategy_variant:'.QQQ251121C510',   dte:126, entry_value:5200,  capital_bp:3000,  max_loss:2600,  rolling_pl:410  },
    { strategy:'SNIPER',   opra_leg1:'.META251017C600',  entry_date:'2025-02-12', qty_leg1:-1,  entry_price_leg1:18.5, spread_leg1:-185, trade_no:'9',  strategy_variant:null,               dte:89,  entry_value:7200,  capital_bp:3200,  max_loss:3000,  rolling_pl:-80  },
    { strategy:'BULLISH',  opra_leg1:'.PLTR251017C90',   entry_date:'2025-02-15', qty_leg1:-5,  entry_price_leg1:2.8,  spread_leg1:-140, trade_no:'10', strategy_variant:null,               dte:86,  entry_value:1800,  capital_bp:850,   max_loss:700,   rolling_pl:60   },
    { strategy:'CROUCHING',opra_leg1:'.MSFT251121P380',  entry_date:'2025-02-18', qty_leg1:-2,  entry_price_leg1:7.2,  spread_leg1:-144, trade_no:'11', strategy_variant:null,               dte:119, entry_value:2800,  capital_bp:1500,  max_loss:1300,  rolling_pl:null },
    { strategy:'(CBS)',    opra_leg1:'.TSLA251017C290',  entry_date:'2025-02-22', qty_leg1:-3,  entry_price_leg1:9.4,  spread_leg1:-329, trade_no:'12', strategy_variant:'.TSLA251017C310',  dte:81,  entry_value:4800,  capital_bp:2500,  max_loss:2200,  rolling_pl:150  },
    { strategy:'DS HAMMER',opra_leg1:'.NVDA251121C150',  entry_date:'2025-02-26', qty_leg1:-2,  entry_price_leg1:11.2, spread_leg1:-280, trade_no:'13', strategy_variant:'.NVDA260116C160',  dte:115, entry_value:6500,  capital_bp:3500,  max_loss:3200,  rolling_pl:-120 },
    { strategy:'BULL',     opra_leg1:'.SPY251017C565',   entry_date:'2025-03-01', qty_leg1:-2,  entry_price_leg1:14.8, spread_leg1:-296, trade_no:'14', strategy_variant:null,               dte:77,  entry_value:8200,  capital_bp:4100,  max_loss:3800,  rolling_pl:280  },
    { strategy:'DIAGONAL', opra_leg1:'.AMZN260116C220',  entry_date:'2025-03-05', qty_leg1:-1,  entry_price_leg1:22.0, spread_leg1:-330, trade_no:'15', strategy_variant:'.AMZN251121C215',  dte:103, entry_value:9500,  capital_bp:4800,  max_loss:4400,  rolling_pl:190  },
  ];
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
console.log('=== Stock Tracker Seed ===');
console.log(`Looking for data in: ${TRADING_DIR}`);
console.log(`Database: ${process.env.DB_PATH || './data/trading.db'}\n`);

seedStocks();
seedTosTrades();
seedOptions();

console.log('\n✓ Seed complete.');
