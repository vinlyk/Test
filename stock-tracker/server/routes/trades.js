const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/trades — optional ?symbol=&strategy=&status=open|closed
router.get('/', (req, res) => {
  let query = 'SELECT * FROM trades WHERE 1=1';
  const params = [];
  if (req.query.symbol) { query += ' AND symbol LIKE ?'; params.push(`%${req.query.symbol}%`); }
  if (req.query.strategy) { query += ' AND strategy LIKE ?'; params.push(`%${req.query.strategy}%`); }
  if (req.query.status === 'open')   { query += ' AND (closed_date IS NULL OR closed_date = "")'; }
  if (req.query.status === 'closed') { query += ' AND closed_date IS NOT NULL AND closed_date != ""'; }
  query += ' ORDER BY bought_date DESC';
  res.json(db.prepare(query).all(...params));
});

// GET /api/trades/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/trades
router.post('/', (req, res) => {
  const {
    symbol, name, strategy, stock_price, strike, call_price, put_price,
    order_price, expiry_date, bought_date, closed_date, max_profit,
    max_loss, profit_ratio, contracts = 1, pl, notes,
  } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const result = db.prepare(`
    INSERT INTO trades
      (symbol, name, strategy, stock_price, strike, call_price, put_price,
       order_price, expiry_date, bought_date, closed_date, max_profit,
       max_loss, profit_ratio, contracts, pl, notes)
    VALUES
      (@symbol, @name, @strategy, @stock_price, @strike, @call_price, @put_price,
       @order_price, @expiry_date, @bought_date, @closed_date, @max_profit,
       @max_loss, @profit_ratio, @contracts, @pl, @notes)
  `).run({
    symbol, name, strategy, stock_price, strike, call_price, put_price,
    order_price, expiry_date, bought_date, closed_date, max_profit,
    max_loss, profit_ratio, contracts, pl, notes,
  });
  res.status(201).json(db.prepare('SELECT * FROM trades WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/trades/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = [
    'symbol', 'name', 'strategy', 'stock_price', 'strike', 'call_price', 'put_price',
    'order_price', 'expiry_date', 'bought_date', 'closed_date', 'max_profit',
    'max_loss', 'profit_ratio', 'contracts', 'pl', 'notes',
  ];
  const upd = {};
  for (const f of fields) upd[f] = req.body[f] !== undefined ? req.body[f] : existing[f];

  db.prepare(`
    UPDATE trades SET
      symbol=@symbol, name=@name, strategy=@strategy, stock_price=@stock_price,
      strike=@strike, call_price=@call_price, put_price=@put_price, order_price=@order_price,
      expiry_date=@expiry_date, bought_date=@bought_date, closed_date=@closed_date,
      max_profit=@max_profit, max_loss=@max_loss, profit_ratio=@profit_ratio,
      contracts=@contracts, pl=@pl, notes=@notes
    WHERE id = ${req.params.id}
  `).run(upd);

  res.json(db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id));
});

// DELETE /api/trades/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
