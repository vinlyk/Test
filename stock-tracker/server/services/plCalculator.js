/**
 * P/L calculation helpers.
 * All prices are per-share or per-contract (NOT multiplied by 100).
 * The 100-multiplier is applied here for options.
 */

function calcUnrealizedPnl(currentPrice, avgCost, qty, isOption) {
  const multiplier = isOption ? 100 : 1;
  return (currentPrice - avgCost) * qty * multiplier;
}

function calcTodayPnl(regularMarketChange, qty, isOption) {
  if (regularMarketChange == null) return 0;
  const multiplier = isOption ? 100 : 1;
  return regularMarketChange * qty * multiplier;
}

function calcIntrinsic(optionType, underlyingPrice, strike) {
  if (optionType === 'C') return Math.max(underlyingPrice - strike, 0);
  if (optionType === 'P') return Math.max(strike - underlyingPrice, 0);
  return 0;
}

function calcExtrinsic(optionLastPrice, intrinsic) {
  return Math.max(optionLastPrice - intrinsic, 0);
}

/**
 * Aggregate Greeks for a group of position legs.
 * Each leg: { delta, gamma, vega, theta, rho, quantity }
 * Returns weighted sum (signed, quantity already includes direction sign).
 */
function aggregateGreeks(legs) {
  const result = { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 };
  for (const leg of legs) {
    const qty = leg.quantity ?? 0;
    result.delta += (leg.delta ?? 0) * qty;
    result.gamma += (leg.gamma ?? 0) * qty;
    result.vega  += (leg.vega  ?? 0) * qty;
    result.theta += (leg.theta ?? 0) * qty;
    result.rho   += (leg.rho   ?? 0) * qty;
  }
  return result;
}

/**
 * Enrich a position row with live P/L data from the price cache.
 * Returns the position row extended with:
 *   unrealizedPnl, todayPnl, currentPrice, intrinsic, extrinsic, greeks
 */
function enrichPosition(position, priceData) {
  if (!priceData) return { ...position, unrealizedPnl: null, todayPnl: null };

  const isOption = position.position_type !== 'stock';
  const unrealizedPnl = calcUnrealizedPnl(
    priceData.price,
    position.avg_cost,
    position.quantity,
    isOption
  );
  const todayPnl = calcTodayPnl(priceData.regularMarketChange, position.quantity, isOption);

  return {
    ...position,
    currentPrice: priceData.price,
    bid: priceData.bid,
    ask: priceData.ask,
    change_pct: priceData.change_pct,
    unrealizedPnl,
    todayPnl,
    totalPnl: unrealizedPnl + (position.realized_pnl ?? 0),
    // Greeks (options only)
    delta: priceData.delta,
    gamma: priceData.gamma,
    vega: priceData.vega,
    theta: priceData.theta,
    rho: priceData.rho,
    iv: priceData.iv,
    intrinsic: priceData.intrinsic,
    extrinsic: priceData.extrinsic,
  };
}

module.exports = {
  calcUnrealizedPnl,
  calcTodayPnl,
  calcIntrinsic,
  calcExtrinsic,
  aggregateGreeks,
  enrichPosition,
};
