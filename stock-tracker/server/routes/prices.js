const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  fetchStockQuote,
  fetchOptionQuote,
  refreshAllPrices,
  writePriceCache,
} = require('../services/priceService');
const { getUSDSGD } = require('../services/fxService');
const { parseOCC } = require('../services/optionParser');

// GET /api/prices — bulk refresh all position symbols, return results + fx rate
router.get('/', async (req, res) => {
  try {
    const [results, fxRate] = await Promise.all([
      refreshAllPrices(),
      getUSDSGD(),
    ]);
    res.json({ results, fxRate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prices/cache — return all cached prices without refreshing
router.get('/cache', (req, res) => {
  const prices = db.prepare('SELECT * FROM price_cache').all();
  const fx = db.prepare("SELECT rate FROM fx_rates WHERE pair = 'USDSGD=X'").get();
  res.json({ prices, fxRate: fx?.rate ?? null });
});

// GET /api/prices/fx — just the USDSGD rate
router.get('/fx', async (req, res) => {
  try {
    const rate = await getUSDSGD();
    res.json({ rate });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prices/stock/:symbol
router.get('/stock/:symbol', async (req, res) => {
  try {
    const data = await fetchStockQuote(req.params.symbol.toUpperCase());
    writePriceCache(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prices/option/:symbol — OCC symbol e.g. AMZN260320C217500
router.get('/option/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!parseOCC(symbol)) {
    return res.status(400).json({ error: 'Invalid OCC option symbol' });
  }
  try {
    const data = await fetchOptionQuote(symbol);
    writePriceCache(data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
