// yahoo-finance2 v2+ is ESM-only; load via dynamic import and cache
let _yf;
async function getYF() {
  if (!_yf) { const m = await import('yahoo-finance2'); _yf = m.default; }
  return _yf;
}

// p-limit is also ESM-only in v5; use dynamic import
let _pLimit;
async function getPLimit() {
  if (!_pLimit) { const m = await import('p-limit'); _pLimit = m.default; }
  return _pLimit;
}

const { parseOCC } = require('./optionParser');
const db = require('../db');

/**
 * Fetch a single stock quote from Yahoo Finance.
 * Returns { price, bid, ask, change_pct, regularMarketChange }
 */
async function fetchStockQuote(symbol) {
  const yahooFinance = await getYF();
  const quote = await yahooFinance.quote(symbol, {
    fields: ['regularMarketPrice', 'bid', 'ask', 'regularMarketChangePercent', 'regularMarketChange'],
  });
  return {
    symbol,
    price: quote.regularMarketPrice,
    bid: quote.bid ?? null,
    ask: quote.ask ?? null,
    change_pct: quote.regularMarketChangePercent ?? null,
    regularMarketChange: quote.regularMarketChange ?? null,
  };
}

/**
 * Fetch option Greeks + price by parsing an OCC symbol.
 * Also fetches the underlying stock price for intrinsic/extrinsic calcs.
 */
async function fetchOptionQuote(occSymbol) {
  const yahooFinance = await getYF();
  const parsed = parseOCC(occSymbol);
  if (!parsed) throw new Error(`Cannot parse OCC symbol: ${occSymbol}`);

  const expiryDate = new Date(parsed.expiry + 'T00:00:00Z');

  const [chain, underlyingQuote] = await Promise.all([
    yahooFinance.options(parsed.underlying, { date: expiryDate }),
    fetchStockQuote(parsed.underlying),
  ]);

  const contracts = parsed.type === 'C' ? chain.options[0]?.calls : chain.options[0]?.puts;
  if (!contracts || contracts.length === 0) {
    throw new Error(`No option chain found for ${occSymbol}`);
  }

  const contract = contracts.find(c => Math.abs(c.strike - parsed.strike) < 0.01);
  if (!contract) {
    throw new Error(`Strike ${parsed.strike} not found in chain for ${occSymbol}`);
  }

  const underlyingPrice = underlyingQuote.price;
  const optionPrice = contract.lastPrice ?? 0;
  const intrinsic = parsed.type === 'C'
    ? Math.max(underlyingPrice - parsed.strike, 0)
    : Math.max(parsed.strike - underlyingPrice, 0);
  const extrinsic = Math.max(optionPrice - intrinsic, 0);

  return {
    symbol: occSymbol,
    price: optionPrice,
    bid: contract.bid ?? null,
    ask: contract.ask ?? null,
    change_pct: contract.percentChange ?? null,
    delta: contract.delta ?? null,
    gamma: contract.gamma ?? null,
    vega: contract.vega ?? null,
    theta: contract.theta ?? null,
    rho: contract.rho ?? null,
    iv: contract.impliedVolatility ?? null,
    intrinsic,
    extrinsic,
    underlyingPrice,
  };
}

/**
 * Write a price result to the price_cache table.
 */
function writePriceCache(data) {
  db.prepare(`
    INSERT INTO price_cache
      (symbol, price, bid, ask, change_pct, delta, gamma, vega, theta, rho, iv, intrinsic, extrinsic, fetched_at)
    VALUES
      (@symbol, @price, @bid, @ask, @change_pct, @delta, @gamma, @vega, @theta, @rho, @iv, @intrinsic, @extrinsic, datetime('now'))
    ON CONFLICT(symbol) DO UPDATE SET
      price = excluded.price, bid = excluded.bid, ask = excluded.ask,
      change_pct = excluded.change_pct, delta = excluded.delta, gamma = excluded.gamma,
      vega = excluded.vega, theta = excluded.theta, rho = excluded.rho,
      iv = excluded.iv, intrinsic = excluded.intrinsic, extrinsic = excluded.extrinsic,
      fetched_at = excluded.fetched_at
  `).run({
    symbol: data.symbol,
    price: data.price ?? null,
    bid: data.bid ?? null,
    ask: data.ask ?? null,
    change_pct: data.change_pct ?? null,
    delta: data.delta ?? null,
    gamma: data.gamma ?? null,
    vega: data.vega ?? null,
    theta: data.theta ?? null,
    rho: data.rho ?? null,
    iv: data.iv ?? null,
    intrinsic: data.intrinsic ?? null,
    extrinsic: data.extrinsic ?? null,
  });
}

/**
 * Bulk refresh all symbols from the positions table.
 * Stock symbols and option OCC symbols are handled separately.
 * Returns array of results (with errors noted per symbol).
 */
async function refreshAllPrices() {
  const pLimit = await getPLimit();
  const limit = pLimit(8);
  const positions = db.prepare('SELECT DISTINCT symbol, position_type FROM positions').all();
  const symbols = positions.map(p => ({ symbol: p.symbol, type: p.position_type }));

  const results = await Promise.all(
    symbols.map(({ symbol, type }) =>
      limit(async () => {
        try {
          const data = type === 'stock'
            ? await fetchStockQuote(symbol)
            : await fetchOptionQuote(symbol);
          writePriceCache(data);
          return { symbol, ok: true };
        } catch (err) {
          return { symbol, ok: false, error: err.message };
        }
      })
    )
  );

  return results;
}

/**
 * Get cached price data for all symbols (from price_cache).
 */
function getCachedPrices() {
  return db.prepare('SELECT * FROM price_cache').all();
}

module.exports = {
  fetchStockQuote,
  fetchOptionQuote,
  refreshAllPrices,
  writePriceCache,
  getCachedPrices,
};
