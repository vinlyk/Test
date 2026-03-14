import { useEffect, useCallback } from 'react';
import { positions as positionsApi } from '../api/client';
import usePortfolioStore from '../store/portfolioStore';

export function usePositions() {
  const setPositions = usePortfolioStore(s => s.setPositions);

  const load = useCallback(async () => {
    try {
      const data = await positionsApi.getAll();
      setPositions(data);
    } catch (_) {}
  }, [setPositions]);

  useEffect(() => { load(); }, [load]);

  return { reload: load };
}
