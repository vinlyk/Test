import { useEffect, useCallback, useRef } from 'react';
import { prices as pricesApi } from '../api/client';
import usePortfolioStore from '../store/portfolioStore';

const REFRESH_MS = parseInt(import.meta.env.VITE_REFRESH_MS ?? '60000', 10);

function isMarketOpen() {
  const now = new Date();
  // NYSE hours: Mon–Fri 9:30–16:00 ET
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = et.getHours();
  const m = et.getMinutes();
  const mins = h * 60 + m;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function usePrices() {
  const { autoRefresh, setRefreshing, setLastRefresh, setMarketOpen, setPriceCache, setFxRate } = usePortfolioStore();
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    const open = isMarketOpen();
    setMarketOpen(open);
    if (!open) return;
    setRefreshing(true);
    try {
      const data = await pricesApi.refreshAll();
      // After refresh, reload the cache
      const cached = await pricesApi.getCache();
      setPriceCache(cached.prices);
      if (cached.fxRate) setFxRate(cached.fxRate);
      setLastRefresh(new Date().toISOString());
    } catch (_) {
      // silently ignore price refresh errors
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing, setLastRefresh, setMarketOpen, setPriceCache, setFxRate]);

  const loadCache = useCallback(async () => {
    try {
      const cached = await pricesApi.getCache();
      setPriceCache(cached.prices);
      if (cached.fxRate) setFxRate(cached.fxRate);
    } catch (_) {}
  }, [setPriceCache, setFxRate]);

  // Load cache on mount
  useEffect(() => { loadCache(); }, [loadCache]);

  // Auto-refresh loop
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(refresh, REFRESH_MS);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, refresh]);

  return { refresh, loadCache };
}
