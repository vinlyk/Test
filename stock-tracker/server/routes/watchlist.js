const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/watchlist
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM watchlist ORDER BY symbol').all());
});

// GET /api/watchlist/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/watchlist
router.post('/', (req, res) => {
  const { symbol, name, category, avg_cost, support_levels, intrinsic_value, currency = 'USD', notes } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const result = db.prepare(`
    INSERT INTO watchlist (symbol, name, category, avg_cost, support_levels, intrinsic_value, currency, notes)
    VALUES (@symbol, @name, @category, @avg_cost, @support_levels, @intrinsic_value, @currency, @notes)
    ON CONFLICT(symbol) DO UPDATE SET
      name=excluded.name, category=excluded.category, avg_cost=excluded.avg_cost,
      support_levels=excluded.support_levels, intrinsic_value=excluded.intrinsic_value,
      currency=excluded.currency, notes=excluded.notes
  `).run({ symbol, name, category, avg_cost, support_levels, intrinsic_value, currency, notes });
  const row = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(result.lastInsertRowid) ||
              db.prepare('SELECT * FROM watchlist WHERE symbol = ?').get(symbol);
  res.status(201).json(row);
});

// PUT /api/watchlist/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const fields = ['symbol','name','category','avg_cost','support_levels','intrinsic_value','currency','notes'];
  const upd = {};
  for (const f of fields) upd[f] = req.body[f] !== undefined ? req.body[f] : existing[f];
  db.prepare(`
    UPDATE watchlist SET symbol=@symbol,name=@name,category=@category,avg_cost=@avg_cost,
      support_levels=@support_levels,intrinsic_value=@intrinsic_value,currency=@currency,notes=@notes
    WHERE id=${req.params.id}
  `).run(upd);
  res.json(db.prepare('SELECT * FROM watchlist WHERE id = ?').get(req.params.id));
});

// DELETE /api/watchlist/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
