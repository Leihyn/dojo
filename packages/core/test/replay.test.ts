import { describe, expect, it } from "vitest";
import { replayGridPlanner, replayRangeKeeper, simulateGrid, timeInRange } from "../src/replay";
import { priceToTick } from "../src/pancake";
import { grade } from "../src/grader";
import type { Bar, BarSeries } from "../src/prices";

function series(prices: number[], startTs = 1_700_000_000_000, stepMs = 300_000): BarSeries {
  return prices.map((p, i) => ({ ts: startTs + i * stepMs, open: p, high: p * 1.001, low: p * 0.999, close: p }));
}
/** Deterministic oscillation, so a grid has something to fill against. */
function chop(n: number, mid = 700, amp = 0.02): number[] {
  return Array.from({ length: n }, (_, i) => mid * (1 + amp * Math.sin(i / 3)));
}

describe("timeInRange", () => {
  it("is 1 when every close sits inside the range and 0 when none do", () => {
    const w = series([700, 701, 702]);
    const lo = priceToTick(690), hi = priceToTick(710);
    expect(timeInRange(w, lo, hi)).toBe(1);
    expect(timeInRange(w, priceToTick(800), priceToTick(900))).toBe(0);
  });

  it("counts the fraction inside for a partially breached range", () => {
    const w = series([700, 800, 700, 800]);
    expect(timeInRange(w, priceToTick(690), priceToTick(710))).toBe(0.5);
  });

  it("returns 0 for an empty window rather than dividing by zero", () => {
    expect(timeInRange([], 0, 100)).toBe(0);
  });
});

describe("simulateGrid", () => {
  it("buys as price crosses levels down and cannot spend more than the budget", () => {
    const levels = [690, 695, 700];
    const w = series([699, 694, 689]);
    const sim = simulateGrid(levels, 100, 300, 705, w, 0);
    expect(sim.fills).toBe(3);
    expect(sim.cash).toBeCloseTo(0, 6);
    expect(sim.position).toBeGreaterThan(0);
  });

  it("never sells a position it does not hold", () => {
    const w = series([700, 720, 740]);
    const sim = simulateGrid([705, 725], 100, 1000, 700, w, 0);
    expect(sim.position).toBe(0);
    expect(sim.cash).toBe(1000);
    expect(sim.fills).toBe(0);
  });

  it("charges the fee on every fill, so a round trip at the same price loses money", () => {
    const w = series([690, 700]);
    const noFee = simulateGrid([695], 100, 1000, 700, w, 0);
    const withFee = simulateGrid([695], 100, 1000, 700, w, 0.0025);
    expect(withFee.finalValue).toBeLessThan(noFee.finalValue);
  });
});

describe("replayRangeKeeper", () => {
  const bars = series(chop(400));

  it("emits one graded receipt per step with a resolved outcome", () => {
    const rs = replayRangeKeeper(bars, { intervalMin: 5, horizonMin: 60, stepBars: 12, positionAgeBars: 24, targetWidthPct: 2 });
    expect(rs.length).toBeGreaterThan(5);
    for (const r of rs) {
      expect(r.outcome?.metric).toBe("time-in-range");
      expect(r.outcome?.horizonMin).toBe(60);
      expect(typeof r.outcome?.excessPct).toBe("number");
      expect(r.inputs[0].provenance).toBe("cached");
    }
  });

  it("marks a hold correct on a tie because rebalancing costs gas", () => {
    const rs = replayRangeKeeper(bars, { intervalMin: 5, horizonMin: 60, stepBars: 12, positionAgeBars: 24, targetWidthPct: 2 });
    const ties = rs.filter((r) => r.decision.kind === "report" && r.outcome?.excessPct === 0);
    for (const t of ties) expect(t.outcome?.correct).toBe(true);
  });

  it("produces no receipts when the series is shorter than the horizon", () => {
    expect(replayRangeKeeper(series(chop(10)), { intervalMin: 5, horizonMin: 600, positionAgeBars: 2 })).toEqual([]);
  });
});

describe("replayGridPlanner", () => {
  const bars = series(chop(400));

  it("scores the ladder against holding the same budget", () => {
    const rs = replayGridPlanner(bars, { intervalMin: 5, horizonMin: 60, stepBars: 12, bandPct: 3, levels: 9, budgetUsd: 1000 });
    expect(rs.length).toBeGreaterThan(5);
    for (const r of rs) {
      expect(r.outcome?.metric).toBe("grid-pnl-vs-hold");
      const o = r.outcome!;
      expect(o.excessPct).toBeCloseTo(o.returnPct! - o.baselineMeanPct!, 10);
      expect(o.correct).toBe(o.excessPct! > 0);
    }
  });

  it("loses to holding in a straight uptrend, because the ladder sells into the rally", () => {
    const up = series(Array.from({ length: 200 }, (_, i) => 700 * (1 + i * 0.001)));
    const rs = replayGridPlanner(up, { intervalMin: 5, horizonMin: 120, stepBars: 12, bandPct: 3, levels: 9, budgetUsd: 1000 });
    expect(rs.length).toBeGreaterThan(0);
    expect(rs.every((r) => r.outcome!.excessPct! <= 0)).toBe(true);
  });
});

describe("grade with resolved outcomes", () => {
  it("grades alert and report decisions that carry their own measured outcome", () => {
    const rs = replayRangeKeeper(series(chop(400)), { intervalMin: 5, horizonMin: 60, stepBars: 12, positionAgeBars: 24, targetWidthPct: 2, agentKey: "97:x" });
    const sc = grade("97:x", { receipts: rs, prices: {}, horizons: [60], primaryHorizonMin: 60 });
    expect(sc.practiceTrades).toBe(0);
    expect(sc.resolvedOutcomes).toBe(rs.length);
    expect(sc.graded).toBe(rs.length);
    expect(sc.horizons[0].n).toBe(rs.length);
  });

  it("takes the hit rate from the measured verdict, not from the sign of a non-return metric", () => {
    const base = replayRangeKeeper(series(chop(200)), { intervalMin: 5, horizonMin: 60, stepBars: 12, positionAgeBars: 24, targetWidthPct: 2, agentKey: "97:y" });
    // time-in-range is always positive; a naive `ret > 0` hit rate would read 100%.
    const forced = base.map((r, i) => ({ ...r, outcome: { ...r.outcome!, returnPct: 0.9, excessPct: i % 2 === 0 ? 0.1 : -0.1, correct: i % 2 === 0 } }));
    const sc = grade("97:y", { receipts: forced, prices: {}, horizons: [60], primaryHorizonMin: 60 });
    expect(sc.horizons[0].hitRate).toBeCloseTo(0.5, 5);
  });
});
