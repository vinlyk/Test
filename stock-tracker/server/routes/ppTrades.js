const express = require('express');
const router = express.Router();
const db = require('../db');
const { parseOPRA } = require('../services/optionParser');

// GET /api/pp-trades
router.get('/', (req, res) => {
  let query = 'SELECT * FROM pp_trades WHERE 1=1';
  const params = [];
  if (req.query.strategy) { query += ' AND strategy LIKE ?'; params.push(`%${req.query.strategy}%`); }
  if (req.query.underlying) { query += ' AND leg1_underlying = ?'; params.push(req.query.underlying.toUpperCase()); }
  query += ' ORDER BY trade_no ASC';
  res.json(db.prepare(query).all(...params));
});

// GET /api/pp-trades/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM pp_trades WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/pp-trades
router.post('/', (req, res) => {
  const {
    trade_no, strategy, strategy_variant,
    leg1_symbol, leg2_symbol,
    entry_date, qty_leg1, entry_price_leg1, spread_leg1,
    dte, entry_value, capital_bp, max_loss, rolling_pl,
  } = req.body;

  const leg1 = leg1_symbol ? parseOPRA(leg1_symbol) : null;
  const leg2 = leg2_symbol ? parseOPRA(leg2_symbol) : null;

  const result = db.prepare(`
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
  `).run({
    trade_no, strategy, strategy_variant,
    leg1_symbol, leg1_underlying: leg1?.underlying ?? null,
    leg1_expiry: leg1?.expiry ?? null, leg1_type: leg1?.type ?? null, leg1_strike: leg1?.strike ?? null,
    leg2_symbol, leg2_underlying: leg2?.underlying ?? null,
    leg2_expiry: leg2?.expiry ?? null, leg2_type: leg2?.type ?? null, leg2_strike: leg2?.strike ?? null,
    entry_date, qty_leg1, entry_price_leg1, spread_leg1,
    dte, entry_value, capital_bp, max_loss, rolling_pl,
  });

  res.status(201).json(db.prepare('SELECT * FROM pp_trades WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/pp-trades/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM pp_trades WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = [
    'trade_no', 'strategy', 'strategy_variant',
    'leg1_symbol', 'leg1_underlying', 'leg1_expiry', 'leg1_type', 'leg1_strike',
    'leg2_symbol', 'leg2_underlying', 'leg2_expiry', 'leg2_type', 'leg2_strike',
    'entry_date', 'qty_leg1', 'entry_price_leg1', 'spread_leg1',
    'dte', 'entry_value', 'capital_bp', 'max_loss', 'rolling_pl',
  ];
  const upd = {};
  for (const f of fields) upd[f] = req.body[f] !== undefined ? req.body[f] : existing[f];

  // Re-parse OPRA symbols if changed
  if (req.body.leg1_symbol) {
    const leg1 = parseOPRA(req.body.leg1_symbol);
    if (leg1) {
      upd.leg1_underlying = leg1.underlying;
      upd.leg1_expiry = leg1.expiry;
      upd.leg1_type = leg1.type;
      upd.leg1_strike = leg1.strike;
    }
  }
  if (req.body.leg2_symbol) {
    const leg2 = parseOPRA(req.body.leg2_symbol);
    if (leg2) {
      upd.leg2_underlying = leg2.underlying;
      upd.leg2_expiry = leg2.expiry;
      upd.leg2_type = leg2.type;
      upd.leg2_strike = leg2.strike;
    }
  }

  db.prepare(`
    UPDATE pp_trades SET
      trade_no=@trade_no, strategy=@strategy, strategy_variant=@strategy_variant,
      leg1_symbol=@leg1_symbol, leg1_underlying=@leg1_underlying, leg1_expiry=@leg1_expiry,
      leg1_type=@leg1_type, leg1_strike=@leg1_strike,
      leg2_symbol=@leg2_symbol, leg2_underlying=@leg2_underlying, leg2_expiry=@leg2_expiry,
      leg2_type=@leg2_type, leg2_strike=@leg2_strike,
      entry_date=@entry_date, qty_leg1=@qty_leg1, entry_price_leg1=@entry_price_leg1,
      spread_leg1=@spread_leg1, dte=@dte, entry_value=@entry_value,
      capital_bp=@capital_bp, max_loss=@max_loss, rolling_pl=@rolling_pl
    WHERE id = ${req.params.id}
  `).run(upd);

  res.json(db.prepare('SELECT * FROM pp_trades WHERE id = ?').get(req.params.id));
});

// DELETE /api/pp-trades/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM pp_trades WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
