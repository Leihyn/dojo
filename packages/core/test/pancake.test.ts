import { describe, expect, it } from "vitest";
import { checkRange, planGrid, priceToTick, sqrtToPrice, tickToPrice } from "../src/pancake";

describe("tick math", () => {
  it("round-trips tick and price", () => {
    expect(tickToPrice(0)).toBe(1);
    expect(priceToTick(tickToPrice(-65806))).toBe(-65806);
    // slot0 observed on the USDT/WBNB 0.05% pool: sqrtPriceX96 ~2.951e27 at tick -65806 -> ~0.00139 BNB per USDT (~$719/BNB)
    const p = sqrtToPrice(2951212428412238291855232078n);
    expect(1 / p).toBeGreaterThan(600);
    expect(1 / p).toBeLessThan(900);
    expect(Math.abs(priceToTick(p) - -65806)).toBeLessThanOrEqual(1);
  });
});

describe("planGrid", () => {
  it("splits budget evenly and sides orders around the current price", () => {
    const g = planGrid({ currentPrice: 700, lower: 600, upper: 800, levels: 5, budgetUsd: 1000 });
    expect(g.orders).toHaveLength(5);
    expect(g.orders[0].price).toBe(600);
    expect(g.orders[4].price).toBeCloseTo(800, 3);
    expect(g.orders.filter((o) => o.side === "buy").length).toBe(3);
    expect(g.perLevelUsd).toBe(200);
    expect(g.warnings).toEqual([]);
  });
  it("warns on out-of-range price and on spacing thinner than fees", () => {
    expect(planGrid({ currentPrice: 900, lower: 600, upper: 800, levels: 5, budgetUsd: 100 }).warnings[0]).toMatch(/outside/);
    expect(planGrid({ currentPrice: 700, lower: 699, upper: 701, levels: 50, budgetUsd: 100 }).warnings[0]).toMatch(/spacing/);
    expect(() => planGrid({ currentPrice: 1, lower: 2, upper: 1, levels: 3, budgetUsd: 1 })).toThrow();
  });
});

describe("checkRange", () => {
  it("holds when comfortably in range", () => {
    const r = checkRange({ currentTick: -65806, tickLower: -66800, tickUpper: -64800, tickSpacing: 10 });
    expect(r.inRange).toBe(true);
    expect(r.action).toBe("hold");
    expect(r.suggestion).toBeNull();
  });
  it("prepares near the edge and rebalances when out, snapping to tick spacing", () => {
    const near = checkRange({ currentTick: -64810, tickLower: -66800, tickUpper: -64800, tickSpacing: 10 });
    expect(near.action).toBe("prepare");
    const out = checkRange({ currentTick: -64000, tickLower: -66800, tickUpper: -64800, tickSpacing: 10, targetWidthPct: 20 });
    expect(out.inRange).toBe(false);
    expect(out.action).toBe("rebalance-now");
    expect(out.suggestion!.tickLower % 10 === 0).toBe(true);
    expect(out.suggestion!.tickLower).toBeLessThan(-64000);
    expect(out.suggestion!.tickUpper).toBeGreaterThan(-64000);
  });
});
