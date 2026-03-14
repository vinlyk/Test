const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/account
router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM account_summary WHERE id = 1').get();
  res.json(row);
});

// PUT /api/account
router.put('/', (req, res) => {
  const fields = [
    'market_value_sgd', 'long_mv_usd', 'short_mv_usd', 'available_funds_sgd',
    'total_cash_sgd', 'usd_balance', 'max_buying_power_sgd', 'risk_level',
    'leverage_ratio', 'excess_liquidity_sgd', 'initial_margin_sgd', 'maintenance_margin_sgd',
  ];
  const current = db.prepare('SELECT * FROM account_summary WHERE id = 1').get();
  const updates = {};
  for (const f of fields) {
    updates[f] = req.body[f] !== undefined ? req.body[f] : current[f];
  }
  db.prepare(`
    UPDATE account_summary SET
      market_value_sgd=@market_value_sgd, long_mv_usd=@long_mv_usd, short_mv_usd=@short_mv_usd,
      available_funds_sgd=@available_funds_sgd, total_cash_sgd=@total_cash_sgd, usd_balance=@usd_balance,
      max_buying_power_sgd=@max_buying_power_sgd, risk_level=@risk_level, leverage_ratio=@leverage_ratio,
      excess_liquidity_sgd=@excess_liquidity_sgd, initial_margin_sgd=@initial_margin_sgd,
      maintenance_margin_sgd=@maintenance_margin_sgd, updated_at=datetime('now')
    WHERE id = 1
  `).run(updates);
  res.json(db.prepare('SELECT * FROM account_summary WHERE id = 1').get());
});

module.exports = router;
