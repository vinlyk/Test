const express = require('express');
const router = express.Router();
const db = require('../db');
const { getCachedPrices } = require('../services/priceService');
const { enrichPosition } = require('../services/plCalculator');

// Build a price lookup map from the cache
function buildPriceMap() {
  const prices = getCachedPrices();
  return Object.fromEntries(prices.map(p => [p.symbol, p]));
}

// GET /api/positions — all positions enriched with live P/L
router.get('/', (req, res) => {
  const positions = db.prepare('SELECT * FROM positions ORDER BY underlying, position_type').all();
  const priceMap = buildPriceMap();
  const enriched = positions.map(p => enrichPosition(p, priceMap[p.symbol]));
  res.json(enriched);
});

// GET /api/positions/:id
router.get('/:id', (req, res) => {
  const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
  if (!position) return res.status(404).json({ error: 'Not found' });
  res.json(position);
});

// POST /api/positions — single position
router.post('/', (req, res) => {
  const {
    symbol, underlying, position_type, strategy_type, strategy_group,
    quantity, avg_cost, realized_pnl = 0, currency = 'USD',
    expiry_date, strike_price, option_type, notes, category,
    support_levels, intrinsic_value,
  } = req.body;

  if (!symbol || !underlying || !position_type || quantity == null || avg_cost == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = db.prepare(`
    INSERT INTO positions
      (symbol, underlying, position_type, strategy_type, strategy_group,
       quantity, avg_cost, realized_pnl, currency, expiry_date,
       strike_price, option_type, notes, category, support_levels, intrinsic_value)
    VALUES
      (@symbol, @underlying, @position_type, @strategy_type, @strategy_group,
       @quantity, @avg_cost, @realized_pnl, @currency, @expiry_date,
       @strike_price, @option_type, @notes, @category, @support_levels, @intrinsic_value)
  `).run({
    symbol, underlying, position_type, strategy_type, strategy_group,
    quantity, avg_cost, realized_pnl, currency, expiry_date,
    strike_price, option_type, notes, category, support_levels, intrinsic_value,
  });

  const created = db.prepare('SELECT * FROM positions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// POST /api/positions/strategy — multi-leg atomic insert
router.post('/strategy', (req, res) => {
  const { legs } = req.body;
  if (!Array.isArray(legs) || legs.length === 0) {
    return res.status(400).json({ error: 'legs array required' });
  }

  // Generate a shared strategy group ID
  const strategyGroup = `sg_${Date.now()}`;
  const insert = db.prepare(`
    INSERT INTO positions
      (symbol, underlying, position_type, strategy_type, strategy_group,
       quantity, avg_cost, realized_pnl, currency, expiry_date,
       strike_price, option_type, notes, category, support_levels, intrinsic_value)
    VALUES
      (@symbol, @underlying, @position_type, @strategy_type, @strategy_group,
       @quantity, @avg_cost, @realized_pnl, @currency, @expiry_date,
       @strike_price, @option_type, @notes, @category, @support_levels, @intrinsic_value)
  `);

  const insertMany = db.transaction((legs) => {
    const ids = [];
    for (const leg of legs) {
      const r = insert.run({ ...leg, strategy_group: strategyGroup, realized_pnl: 0, currency: leg.currency || 'USD' });
      ids.push(r.lastInsertRowid);
    }
    return ids;
  });

  const ids = insertMany(legs);
  const created = ids.map(id => db.prepare('SELECT * FROM positions WHERE id = ?').get(id));
  res.status(201).json(created);
});

// PUT /api/positions/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = [
    'symbol', 'underlying', 'position_type', 'strategy_type', 'strategy_group',
    'quantity', 'avg_cost', 'realized_pnl', 'currency', 'expiry_date',
    'strike_price', 'option_type', 'notes', 'category', 'support_levels', 'intrinsic_value',
  ];
  const updates = {};
  for (const f of fields) {
    updates[f] = req.body[f] !== undefined ? req.body[f] : existing[f];
  }

  db.prepare(`
    UPDATE positions SET
      symbol=@symbol, underlying=@underlying, position_type=@position_type,
      strategy_type=@strategy_type, strategy_group=@strategy_group,
      quantity=@quantity, avg_cost=@avg_cost, realized_pnl=@realized_pnl,
      currency=@currency, expiry_date=@expiry_date, strike_price=@strike_price,
      option_type=@option_type, notes=@notes, category=@category,
      support_levels=@support_levels, intrinsic_value=@intrinsic_value
    WHERE id = ${req.params.id}
  `).run(updates);

  res.json(db.prepare('SELECT * FROM positions WHERE id = ?').get(req.params.id));
});

// DELETE /api/positions/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM positions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
