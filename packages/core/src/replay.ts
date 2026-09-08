/**
 * Replay grading.
 *
 * The reference agents do not place directional trades, so forward-return scoring has nothing to
 * bite on. What they do produce is a checkable claim, and each claim has its own natural measure:
 * the Range Keeper says a position should be recentred, so the question is whether recentring held
 * the price in range longer than doing nothing; the Grid Planner lays a ladder, so the question is
 * whether the ladder beat simply holding over the same window.
 *
 * Replaying those rules over real BNB/USDT history produces graded receipts today instead of after
 * weeks of live traffic. It is a backtest and the marketplace labels it as one: every receipt
 * carries `cached` provenance and names the bar window it was measured on.
 */
import { checkRange, planGrid, priceToTick, tickToPrice } from "./pancake";
import { newReceiptId, receiptSchema, type Receipt } from "./receipts";
import type { BarSeries } from "./prices";

export interface ReplayCommon {
  /** Minutes per bar in the supplied series. */
  intervalMin: number;
  /** Minutes between the decision and the measurement. */
  horizonMin?: number;
  /** Bars to advance between decisions. Larger means fewer, less overlapping samples. */
  stepBars?: number;
  agentKey?: string;
  agentName?: string;
  symbol?: string;
}

export interface RangeReplayOpts extends ReplayCommon {
  /** How long before the decision the position was opened, in bars. */
  positionAgeBars?: number;
  targetWidthPct?: number;
  tickSpacing?: number;
}

export interface GridReplayOpts extends ReplayCommon {
  /** Half-width of the grid around the price at decision time. */
  bandPct?: number;
  levels?: number;
  budgetUsd?: number;
  /** Round-trip fee charged on every fill, in basis points. PancakeSwap v2 is 25. */
  feeBps?: number;
}

const DEFAULT_HORIZON = 240;

/**
 * Range Keeper: at each step a position opened `positionAgeBars` ago is checked against the current
 * price. Whatever the agent advises is compared with the alternative over the next horizon, scored
 * as the fraction of bars the price spent inside the range. Holding wins ties because it costs no
 * gas; a rebalance has to actually beat doing nothing.
 */
export function replayRangeKeeper(bars: BarSeries, opts: RangeReplayOpts): Receipt[] {
  const horizonMin = opts.horizonMin ?? DEFAULT_HORIZON;
  const horizonBars = Math.max(1, Math.round(horizonMin / opts.intervalMin));
  const step = opts.stepBars ?? Math.max(1, Math.round(60 / opts.intervalMin));
  const ageBars = opts.positionAgeBars ?? Math.max(1, Math.round(720 / opts.intervalMin));
  const widthPct = opts.targetWidthPct ?? 20;
  const spacing = opts.tickSpacing ?? 10;
  const agentKey = opts.agentKey ?? "seed:range-keeper";
  const symbol = opts.symbol ?? "BNBUSDT";

  const half = Math.log(1 + widthPct / 200) / Math.log(1.0001);
  const snap = (t: number) => Math.round(t / spacing) * spacing;
  const out: Receipt[] = [];

  for (let i = ageBars; i + horizonBars < bars.length; i += step) {
    const openPrice = bars[i - ageBars].close;
    const price = bars[i].close;
    const openTick = priceToTick(openPrice);
    const tickLower = snap(openTick - half);
    const tickUpper = snap(openTick + half);
    if (tickUpper <= tickLower) continue;
    const currentTick = priceToTick(price);
    const check = checkRange({ currentTick, tickLower, tickUpper, tickSpacing: spacing, targetWidthPct: widthPct });

    // What the agent's advice commits you to, versus the alternative it rejected.
    const recentred = { tickLower: snap(currentTick - half), tickUpper: snap(currentTick + half) };
    const chosen = check.action === "hold" ? { tickLower, tickUpper } : (check.suggestion ?? recentred);
    const rejected = check.action === "hold" ? recentred : { tickLower, tickUpper };

    const window = bars.slice(i + 1, i + 1 + horizonBars);
    const fracChosen = timeInRange(window, chosen.tickLower, chosen.tickUpper);
    const fracRejected = timeInRange(window, rejected.tickLower, rejected.tickUpper);
    const excess = fracChosen - fracRejected;
    const correct = check.action === "hold" ? excess >= 0 : excess > 0;

    const startedAt = new Date(bars[i].ts).toISOString();
    const completedAt = new Date(bars[i].ts + 1000).toISOString();
    out.push(receiptSchema.parse({
      id: newReceiptId(`${agentKey}-r`, startedAt),
      agentKey,
      agentName: opts.agentName ?? "Dojo Range Keeper",
      category: "rebalancing",
      task: `range-check ${symbol} [${tickLower}, ${tickUpper})`,
      startedAt,
      completedAt,
      inputs: [{
        tool: "prices.bars",
        args: { symbol, interval: `${opts.intervalMin}m`, at: bars[i].ts },
        provenance: "cached",
        source: "binance:klines",
        note: "replayed bar, not a live pool read",
      }],
      reasoning: [
        `Position opened ${ageBars} bars earlier at $${openPrice.toFixed(2)}; range [${tickLower}, ${tickUpper}) is ${widthPct}% wide.`,
        `Price is $${price.toFixed(2)}, ${check.inRange ? "inside" : "outside"} the range, ${Math.abs(check.distanceToEdgePct).toFixed(2)}% ${check.inRange ? "from the nearest edge" : "beyond it"}.`,
        check.action === "hold"
          ? "Held the range; the alternative was recentring on the current tick."
          : `Advised ${check.action === "rebalance-now" ? "an immediate rebalance" : "preparing to rebalance"} to [${chosen.tickLower}, ${chosen.tickUpper}); the alternative was leaving the position alone.`,
        `Over the next ${horizonMin} minutes the chosen range held price for ${(fracChosen * 100).toFixed(1)}% of bars against ${(fracRejected * 100).toFixed(1)}% for the alternative.`,
      ],
      decision: check.action === "hold"
        ? { kind: "report", summary: "in range, hold" }
        : { kind: "alert", severity: check.action === "rebalance-now" ? "critical" : "warning", subject: `${tickLower}:${tickUpper}`, message: check.action === "rebalance-now" ? "position is out of range and earning no fees; rebalance" : "price is within 1% of the range edge; prepare to rebalance" },
      cost: { usd: 0, wallMs: 0 },
      outcome: {
        evaluatedAt: new Date(bars[i + horizonBars].ts).toISOString(),
        horizonMin,
        metric: "time-in-range",
        returnPct: fracChosen,
        baselineMeanPct: fracRejected,
        excessPct: excess,
        correct,
        note: `share of ${window.length} bars with price inside the range; ties go to holding because a rebalance costs gas`,
      },
    }));
  }
  return out;
}

/**
 * Grid Planner: at each step the agent's own planGrid lays a ladder around the current price. The
 * ladder is then walked bar by bar, filling a level whenever the close crosses it, and the result is
 * compared with putting the same budget into BNB and holding. Fills pay the pool fee. The comparison
 * favours holding in a strong trend and the grid in chop, which is the honest shape of the strategy.
 */
export function replayGridPlanner(bars: BarSeries, opts: GridReplayOpts): Receipt[] {
  const horizonMin = opts.horizonMin ?? DEFAULT_HORIZON;
  const horizonBars = Math.max(1, Math.round(horizonMin / opts.intervalMin));
  const step = opts.stepBars ?? Math.max(1, Math.round(60 / opts.intervalMin));
  const bandPct = opts.bandPct ?? 3;
  const levels = opts.levels ?? 9;
  const budgetUsd = opts.budgetUsd ?? 1000;
  const fee = (opts.feeBps ?? 25) / 10_000;
  const agentKey = opts.agentKey ?? "seed:grid-planner";
  const symbol = opts.symbol ?? "BNBUSDT";
  const out: Receipt[] = [];

  for (let i = 0; i + horizonBars < bars.length; i += step) {
    const price = bars[i].close;
    const lower = price * (1 - bandPct / 100);
    const upper = price * (1 + bandPct / 100);
    let plan;
    try { plan = planGrid({ currentPrice: price, lower, upper, levels, budgetUsd }); } catch { continue; }

    const window = bars.slice(i + 1, i + 1 + horizonBars);
    if (window.length === 0) continue;
    const sim = simulateGrid(plan.orders.map((o) => o.price), plan.perLevelUsd, budgetUsd, price, window, fee);
    const exit = window[window.length - 1].close;
    const gridRet = sim.finalValue / budgetUsd - 1;
    const holdRet = exit / price - 1;
    const excess = gridRet - holdRet;

    const startedAt = new Date(bars[i].ts).toISOString();
    const completedAt = new Date(bars[i].ts + 1000).toISOString();
    out.push(receiptSchema.parse({
      id: newReceiptId(`${agentKey}-g`, startedAt),
      agentKey,
      agentName: opts.agentName ?? "Dojo Grid Planner",
      category: "grid",
      task: `grid-plan ${symbol} ${levels} levels ±${bandPct}%`,
      startedAt,
      completedAt,
      inputs: [{
        tool: "prices.bars",
        args: { symbol, interval: `${opts.intervalMin}m`, at: bars[i].ts },
        provenance: "cached",
        source: "binance:klines",
        note: "replayed bar, not a live pool read",
      }],
      reasoning: [
        `Price $${price.toFixed(2)}; ${levels} levels between $${lower.toFixed(2)} and $${upper.toFixed(2)} gives ${plan.spacingPct.toFixed(2)}% spacing and $${plan.perLevelUsd} per level.`,
        ...plan.warnings.map((w) => `Warning: ${w}`),
        `Over the next ${horizonMin} minutes the ladder filled ${sim.fills} time(s) and ended worth $${sim.finalValue.toFixed(2)} against $${(budgetUsd * (1 + holdRet)).toFixed(2)} for holding.`,
      ],
      decision: { kind: "report", summary: `${plan.orders.filter((o) => o.side === "buy").length} buys / ${plan.orders.filter((o) => o.side === "sell").length} sells, ${plan.spacingPct.toFixed(2)}% apart` },
      cost: { usd: 0, wallMs: 0 },
      outcome: {
        evaluatedAt: new Date(bars[i + horizonBars].ts).toISOString(),
        horizonMin,
        metric: "grid-pnl-vs-hold",
        returnPct: gridRet,
        baselineMeanPct: holdRet,
        excessPct: excess,
        correct: excess > 0,
        note: `${sim.fills} fills at ${(fee * 10_000).toFixed(0)}bps; baseline is the same budget held in BNB`,
      },
    }));
  }
  return out;
}

/** Fraction of bars whose close sits inside the tick range. */
export function timeInRange(window: BarSeries, tickLower: number, tickUpper: number): number {
  if (window.length === 0) return 0;
  const lo = tickToPrice(tickLower), hi = tickToPrice(tickUpper);
  let n = 0;
  for (const b of window) {
    const p = tickToPrice(priceToTick(b.close));
    if (p >= lo && p < hi) n++;
  }
  return n / window.length;
}

export interface GridSim { finalValue: number; fills: number; cash: number; position: number }

/**
 * Walk the ladder close by close. A level fills when the close crosses it: downward crossings buy,
 * upward crossings sell, each for one level's worth. Buys stop when cash runs out and sells stop
 * when the position is empty, so the simulation can never spend money it does not have.
 */
export function simulateGrid(levelPrices: number[], perLevelUsd: number, budgetUsd: number, entryPrice: number, window: BarSeries, fee: number): GridSim {
  let cash = budgetUsd, pos = 0, fills = 0;
  let prev = entryPrice;
  const levels = [...levelPrices].sort((a, b) => a - b);
  for (const bar of window) {
    const cur = bar.close;
    for (const L of levels) {
      if (prev > L && cur <= L && cash >= perLevelUsd) {
        cash -= perLevelUsd;
        pos += (perLevelUsd * (1 - fee)) / L;
        fills++;
      } else if (prev < L && cur >= L && pos > 0) {
        const qty = Math.min(perLevelUsd / L, pos);
        pos -= qty;
        cash += qty * L * (1 - fee);
        fills++;
      }
    }
    prev = cur;
  }
  const exit = window[window.length - 1].close;
  return { finalValue: cash + pos * exit, fills, cash, position: pos };
}
