const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.join(__dirname, '../data/portfolio.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS positions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol         TEXT NOT NULL,
    underlying     TEXT NOT NULL,
    position_type  TEXT NOT NULL CHECK(position_type IN ('stock','call','put')),
    strategy_type  TEXT,
    strategy_group TEXT,
    quantity       REAL NOT NULL,
    avg_cost       REAL NOT NULL,
    realized_pnl   REAL NOT NULL DEFAULT 0,
    currency       TEXT NOT NULL DEFAULT 'USD',
    expiry_date    TEXT,
    strike_price   REAL,
    option_type    TEXT CHECK(option_type IN ('C','P',NULL)),
    opened_at      TEXT DEFAULT (datetime('now')),
    notes          TEXT,
    category       TEXT,
    support_levels TEXT,
    intrinsic_value TEXT
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol          TEXT NOT NULL UNIQUE,
    name            TEXT,
    category        TEXT,
    avg_cost        REAL,
    support_levels  TEXT,
    intrinsic_value TEXT,
    currency        TEXT DEFAULT 'USD',
    notes           TEXT
  );

  CREATE TABLE IF NOT EXISTS trades (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT NOT NULL,
    name          TEXT,
    strategy      TEXT,
    stock_price   REAL,
    strike        TEXT,
    call_price    TEXT,
    put_price     TEXT,
    order_price   REAL,
    expiry_date   TEXT,
    bought_date   TEXT,
    closed_date   TEXT,
    max_profit    REAL,
    max_loss      REAL,
    profit_ratio  REAL,
    contracts     INTEGER DEFAULT 1,
    pl            REAL,
    notes         TEXT
  );

  CREATE TABLE IF NOT EXISTS pp_trades (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_no         INTEGER,
    strategy         TEXT,
    strategy_variant TEXT,
    leg1_symbol      TEXT,
    leg1_underlying  TEXT,
    leg1_expiry      TEXT,
    leg1_type        TEXT,
    leg1_strike      REAL,
    leg2_symbol      TEXT,
    leg2_underlying  TEXT,
    leg2_expiry      TEXT,
    leg2_type        TEXT,
    leg2_strike      REAL,
    entry_date       TEXT,
    qty_leg1         REAL,
    entry_price_leg1 REAL,
    spread_leg1      REAL,
    dte              INTEGER,
    entry_value      REAL,
    capital_bp       REAL,
    max_loss         REAL,
    rolling_pl       REAL
  );

  CREATE TABLE IF NOT EXISTS account_summary (
    id                    INTEGER PRIMARY KEY DEFAULT 1,
    market_value_sgd      REAL DEFAULT 0,
    long_mv_usd           REAL DEFAULT 0,
    short_mv_usd          REAL DEFAULT 0,
    available_funds_sgd   REAL DEFAULT 0,
    total_cash_sgd        REAL DEFAULT 0,
    usd_balance           REAL DEFAULT 0,
    max_buying_power_sgd  REAL DEFAULT 0,
    risk_level            TEXT,
    leverage_ratio        REAL DEFAULT 0,
    excess_liquidity_sgd  REAL DEFAULT 0,
    initial_margin_sgd    REAL DEFAULT 0,
    maintenance_margin_sgd REAL DEFAULT 0,
    updated_at            TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_cache (
    symbol      TEXT PRIMARY KEY,
    price       REAL,
    bid         REAL,
    ask         REAL,
    change_pct  REAL,
    delta       REAL,
    gamma       REAL,
    vega        REAL,
    theta       REAL,
    rho         REAL,
    iv          REAL,
    intrinsic   REAL,
    extrinsic   REAL,
    fetched_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fx_rates (
    pair       TEXT PRIMARY KEY,
    rate       REAL NOT NULL,
    fetched_at TEXT DEFAULT (datetime('now'))
  );
`);

// Ensure account_summary has a singleton row
const row = db.prepare('SELECT id FROM account_summary WHERE id = 1').get();
if (!row) {
  db.prepare('INSERT INTO account_summary (id) VALUES (1)').run();
}

module.exports = db;
