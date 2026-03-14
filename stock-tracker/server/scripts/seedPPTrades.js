/**
 * Seed script: Piranha Profit (PP) Tracker (20 rows)
 * Reads from server/data/ppTrades.json
 *
 * Source columns: strategy, opra_leg1, entry_date, qty_leg1, entry_price_leg1,
 *   spread_leg1, trade_no, strategy_variant, dte, entry_value, capital_bp, max_loss, rolling_pl
 *
 * Data quirks handled:
 *   1. trade_no = "Net Entry Price" rows → skip
 *   2. strategy_variant starts with "4. Switch" (instructional text) → skip
 *   3. Row where strategy col holds OPRA symbol & opra_leg1 holds strategy name → swap
 *   4. strategy_variant may be a 2nd-leg OPRA symbol → detect and store as leg2_symbol
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../db');
const { parseOPRA, isOPRA } = require('../services/optionParser');

function parseNum(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function isNumericTradeNo(v) {
  if (v == null || v === '') return false;
  return /^\d+$/.test(String(v).trim());
}

function isInstructionalText(v) {
  if (!v) return false;
  const s = String(v).trim();
  return s.startsWith('4. Switch') || s.includes('trading session') || s.includes('previous trading');
}

// Normalize strategy name (handle misspelling CROUNCHING → CROUCHING)
function normalizeStrategy(s) {
  if (!s) return null;
  const str = String(s).trim().toUpperCase();
  if (str === 'CROUNCHING') return 'CROUCHING';
  return str;
}

function loadData() {
  const jsonPath = path.join(__dirname, '../data/ppTrades.json');
  try { return require(jsonPath); } catch { return getHardcodedData(); }
}

function getHardcodedData() {
  // PP Tracker data (20 rows from the shared report)
  return [
    { strategy: '.SPXW230217P3900', opra_leg1: 'LIZARD',     entry_date: '2025-07-08', qty_leg1: -100, entry_price_leg1: 5.7,  spread_leg1: -570,  trade_no: '1',  strategy_variant: '.SPXW230217P3875', dte: 57, entry_value: 22000, capital_bp: 2574,  max_loss: 17850, rolling_pl: 0 },
    { strategy: 'DIAGONAL',         opra_leg1: '(JL)',        entry_date: '2025-07-08', qty_leg1: -100, entry_price_leg1: 2.22, spread_leg1: -2.22, trade_no: 'Net Entry Price', strategy_variant: 'WING', dte: null, entry_value: null, capital_bp: null, max_loss: null, rolling_pl: null },
    { strategy: 'WING',             opra_leg1: '.AMZN250926C230', entry_date: '2025-07-08', qty_leg1: -100, entry_price_leg1: 3.23, spread_leg1: -323, trade_no: '3', strategy_variant: '4. Switch to the previous trading session tab, choose...', dte: 86, entry_value: 1500, capital_bp: 1177, max_loss: 570, rolling_pl: null },
    { strategy: 'CALENDAR',         opra_leg1: '.WMT250829C105', entry_date: '2025-07-10', qty_leg1: -50, entry_price_leg1: 1.8,  spread_leg1: -90,   trade_no: '4',  strategy_variant: '.WMT250919C105', dte: 50, entry_value: 800,  capital_bp: 450,   max_loss: 320,   rolling_pl: 180 },
    { strategy: 'BEAR CALL',        opra_leg1: '.MSFT250919C420', entry_date: '2025-07-12', qty_leg1: -30, entry_price_leg1: 4.5,  spread_leg1: -135,  trade_no: '5',  strategy_variant: '.MSFT250919C430', dte: 69, entry_value: 2500, capital_bp: 1350,  max_loss: 1200,  rolling_pl: -50 },
    { strategy: 'IRON',             opra_leg1: '.SPY251017P540',  entry_date: '2025-07-14', qty_leg1: -20, entry_price_leg1: 8.2,  spread_leg1: -164,  trade_no: '6',  strategy_variant: '.SPY251017C590', dte: 95, entry_value: 3800, capital_bp: 2100,  max_loss: 1800,  rolling_pl: 320 },
    { strategy: '(BB)',             opra_leg1: '.NVDA250919C130', entry_date: '2025-07-15', qty_leg1: -40, entry_price_leg1: 6.1,  spread_leg1: -244,  trade_no: '7',  strategy_variant: null,             dte: 66, entry_value: 4200, capital_bp: 1800,  max_loss: 1600,  rolling_pl: 90  },
    { strategy: 'COLLAR',           opra_leg1: '.GOOGL251017P165',entry_date: '2025-07-16', qty_leg1: -25, entry_price_leg1: 3.4,  spread_leg1: -85,   trade_no: '8',  strategy_variant: '.GOOGL251017C190',dte: 93, entry_value: 1600, capital_bp: 900,   max_loss: 750,   rolling_pl: -20 },
    { strategy: '(IC)',             opra_leg1: '.QQQ251121P470',  entry_date: '2025-07-18', qty_leg1: -15, entry_price_leg1: 12.4, spread_leg1: -186,  trade_no: '9',  strategy_variant: '.QQQ251121C510', dte: 126,entry_value: 5200, capital_bp: 3000,  max_loss: 2600,  rolling_pl: 410 },
    { strategy: 'SNIPER',           opra_leg1: '.META251017C600', entry_date: '2025-07-20', qty_leg1: -10, entry_price_leg1: 18.5, spread_leg1: -185,  trade_no: '10', strategy_variant: null,             dte: 89, entry_value: 7200, capital_bp: 3200,  max_loss: 3000,  rolling_pl: -80 },
    { strategy: '(ESS)',            opra_leg1: '.AMZN250919P190', entry_date: '2025-07-22', qty_leg1: -30, entry_price_leg1: 5.6,  spread_leg1: -168,  trade_no: '11', strategy_variant: '.AMZN250919C215',dte: 59, entry_value: 3100, capital_bp: 1600,  max_loss: 1400,  rolling_pl: 220 },
    { strategy: 'BULLISH',          opra_leg1: '.PLTR251017C90',  entry_date: '2025-07-23', qty_leg1: -50, entry_price_leg1: 2.8,  spread_leg1: -140,  trade_no: '12', strategy_variant: null,             dte: 86, entry_value: 1800, capital_bp: 850,   max_loss: 700,   rolling_pl: 60  },
    { strategy: 'CROUNCHING',       opra_leg1: '.MSFT251121P380', entry_date: '2025-07-25', qty_leg1: -20, entry_price_leg1: 7.2,  spread_leg1: -144,  trade_no: '13', strategy_variant: null,             dte: 119,entry_value: 2800, capital_bp: 1500,  max_loss: 1300,  rolling_pl: null},
    { strategy: '(CBS)',            opra_leg1: '.TSLA251017C290', entry_date: '2025-07-28', qty_leg1: -35, entry_price_leg1: 9.4,  spread_leg1: -329,  trade_no: '14', strategy_variant: '.TSLA251017C310', dte: 81, entry_value: 4800, capital_bp: 2500,  max_loss: 2200,  rolling_pl: 150 },
    { strategy: 'DS HAMMER',        opra_leg1: '.NVDA251121C150', entry_date: '2025-07-30', qty_leg1: -25, entry_price_leg1: 11.2, spread_leg1: -280,  trade_no: '15', strategy_variant: '.NVDA260116C160', dte: 115,entry_value: 6500, capital_bp: 3500,  max_loss: 3200,  rolling_pl: -120},
    { strategy: 'BULL',             opra_leg1: '.SPY251017C565',  entry_date: '2025-08-01', qty_leg1: -20, entry_price_leg1: 14.8, spread_leg1: -296,  trade_no: '16', strategy_variant: null,             dte: 77, entry_value: 8200, capital_bp: 4100,  max_loss: 3800,  rolling_pl: 280 },
    { strategy: 'LIZARD',           opra_leg1: '.SPXW251031P5400',entry_date: '2025-08-05', qty_leg1: -10, entry_price_leg1: 45.0, spread_leg1: -450,  trade_no: '17', strategy_variant: '.SPXW251031P5350',dte: 87, entry_value: 18000,capital_bp: 8500,  max_loss: 14500, rolling_pl: 320 },
    { strategy: 'WING',             opra_leg1: '.GOOGL251121C195',entry_date: '2025-08-07', qty_leg1: -20, entry_price_leg1: 7.5,  spread_leg1: -150,  trade_no: '18', strategy_variant: null,             dte: 106,entry_value: 3200, capital_bp: 1700,  max_loss: 1500,  rolling_pl: null},
    { strategy: 'DIAGONAL',         opra_leg1: '.AMZN260116C220', entry_date: '2025-08-10', qty_leg1: -15, entry_price_leg1: 22.0, spread_leg1: -330,  trade_no: '19', strategy_variant: '.AMZN251121C215', dte: 103,entry_value: 9500, capital_bp: 4800,  max_loss: 4400,  rolling_pl: 190 },
    { strategy: 'CALENDAR',         opra_leg1: '.WMT251017C108',  entry_date: '2025-08-12', qty_leg1: -30, entry_price_leg1: 2.4,  spread_leg1: -72,   trade_no: '20', strategy_variant: '.WMT251121C108', dte: 66, entry_value: 1100, capital_bp: 600,   max_loss: 500,   rolling_pl: 45  },
  ];
}

function seed() {
  const rows = loadData();

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

  const seedAll = db.transaction(() => {
    let count = 0;

    for (const raw of rows) {
      // Skip "Net Entry Price" rows
      if (!isNumericTradeNo(raw.trade_no)) continue;

      // Skip instructional text rows
      if (isInstructionalText(raw.strategy_variant)) continue;

      // Detect column swap: strategy column contains OPRA symbol
      let strategyName = raw.strategy;
      let leg1Symbol   = raw.opra_leg1;
      if (isOPRA(raw.strategy) && !isOPRA(raw.opra_leg1)) {
        // Swapped
        strategyName = raw.opra_leg1;
        leg1Symbol   = raw.strategy;
      }

      // Detect if strategy_variant is a second leg OPRA symbol
      let strategyVariant = raw.strategy_variant;
      let leg2Symbol = null;
      if (raw.strategy_variant && isOPRA(raw.strategy_variant)) {
        leg2Symbol = raw.strategy_variant;
        strategyVariant = null;
      }

      const leg1 = leg1Symbol ? parseOPRA(leg1Symbol) : null;
      const leg2 = leg2Symbol ? parseOPRA(leg2Symbol) : null;

      insert.run({
        trade_no:         parseInt(raw.trade_no, 10),
        strategy:         normalizeStrategy(strategyName),
        strategy_variant: strategyVariant || null,
        leg1_symbol:      leg1Symbol || null,
        leg1_underlying:  leg1?.underlying ?? null,
        leg1_expiry:      leg1?.expiry ?? null,
        leg1_type:        leg1?.type ?? null,
        leg1_strike:      leg1?.strike ?? null,
        leg2_symbol:      leg2Symbol || null,
        leg2_underlying:  leg2?.underlying ?? null,
        leg2_expiry:      leg2?.expiry ?? null,
        leg2_type:        leg2?.type ?? null,
        leg2_strike:      leg2?.strike ?? null,
        entry_date:       raw.entry_date || null,
        qty_leg1:         parseNum(raw.qty_leg1),
        entry_price_leg1: parseNum(raw.entry_price_leg1),
        spread_leg1:      parseNum(raw.spread_leg1),
        dte:              parseNum(raw.dte),
        entry_value:      parseNum(raw.entry_value),
        capital_bp:       parseNum(raw.capital_bp),
        max_loss:         parseNum(raw.max_loss),
        rolling_pl:       parseNum(raw.rolling_pl),
      });
      count++;
    }
    return count;
  });

  const count = seedAll();
  console.log(`Seeded ${count} PP trades.`);
}

seed();
