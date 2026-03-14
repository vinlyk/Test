let _yf;
async function getYF() {
  if (!_yf) { const m = await import('yahoo-finance2'); _yf = m.default; }
  return _yf;
}
const db = require('../db');

const PAIR = 'USDSGD=X';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getUSDSGD() {
  const cached = db.prepare('SELECT rate, fetched_at FROM fx_rates WHERE pair = ?').get(PAIR);
  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) return cached.rate;
  }

  try {
    const yahooFinance = await getYF();
    const quote = await yahooFinance.quote(PAIR);
    const rate = quote.regularMarketPrice;
    db.prepare(`
      INSERT INTO fx_rates (pair, rate, fetched_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(pair) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at
    `).run(PAIR, rate);
    return rate;
  } catch (err) {
    if (cached) return cached.rate; // stale fallback
    throw err;
  }
}

module.exports = { getUSDSGD };
