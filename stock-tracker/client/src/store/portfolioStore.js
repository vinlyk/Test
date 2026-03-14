import { create } from 'zustand';

const usePortfolioStore = create((set, get) => ({
  positions:    [],
  priceCache:   {},   // symbol → price data
  fxRate:       null, // USDSGD
  currency:     'USD',
  autoRefresh:  false,
  refreshing:   false,
  lastRefresh:  null,
  marketOpen:   false,

  setPositions:   (positions)  => set({ positions }),
  setPriceCache:  (cache)      => set({ priceCache: Object.fromEntries(cache.map(p => [p.symbol, p])) }),
  setFxRate:      (rate)       => set({ fxRate: rate }),
  toggleCurrency: ()           => set(s => ({ currency: s.currency === 'USD' ? 'SGD' : 'USD' })),
  setAutoRefresh: (val)        => set({ autoRefresh: val }),
  setRefreshing:  (val)        => set({ refreshing: val }),
  setLastRefresh: (ts)         => set({ lastRefresh: ts }),
  setMarketOpen:  (val)        => set({ marketOpen: val }),

  // Convenience: get price for a symbol
  getPrice: (symbol) => get().priceCache[symbol] ?? null,

  // Convert a USD value to display currency
  toDisplay: (usdValue) => {
    const { currency, fxRate } = get();
    if (!usdValue) return usdValue;
    return currency === 'SGD' && fxRate ? usdValue * fxRate : usdValue;
  },
}));

export default usePortfolioStore;
