import { describe, expect, it } from "vitest";
import { baselineReturns, compositeScore, forwardReturns, grade, wilsonLower } from "../src/grader";
import type { Receipt } from "../src/receipts";

function series(startTs: number, minutes: number, driftPerMin: number, start = 100): { ts: number; open: number; close: number }[] {
  const out = []; let p = start;
  for (let i = 0; i < minutes; i++) { const open = p; p = p * (1 + driftPerMin); out.push({ ts: startTs + i * 60_000, open, close: p }); }
  return out;
}

describe("wilsonLower", () => {
  it("matches known values", () => {
    expect(wilsonLower(0, 0)).toBe(0);
    expect(wilsonLower(10, 10)).toBeCloseTo(0.722, 2);
    expect(wilsonLower(5, 10)).toBeCloseTo(0.237, 2);
    expect(wilsonLower(50, 100)).toBeCloseTo(0.404, 2);
  });
});

describe("forwardReturns", () => {
  const t0 = Date.UTC(2026, 0, 1);
  const px = series(t0, 500, 0.001);
  it("enters at the first candle at or after the decision and exits at the horizon close", () => {
    const fr = forwardReturns(px, t0 + 90_000, [1, 10]);
    expect(fr).not.toBeNull();
    expect(fr!.entryTs).toBe(t0 + 120_000);
    expect(fr!.rets[1]).toBeCloseTo(1.001 ** 2 - 1, 6);
    expect(fr!.rets[10]).toBeCloseTo(1.001 ** 11 - 1, 6);
  });
  it("returns null when the decision falls past the price history", () => {
    expect(forwardReturns(px, t0 + 600 * 60_000, [1])).toBeNull();
  });
  it("marks horizons beyond history as null", () => {
    const fr = forwardReturns(px, t0 + 495 * 60_000, [1, 60]);
    expect(fr!.rets[1]).not.toBeNull();
    expect(fr!.rets[60]).toBeNull();
  });
});

describe("baselineReturns", () => {
  it("is empty on short histories and positive on an up-drifting series", () => {
    expect(baselineReturns(series(0, 5, 0.01), [1], 100)[1]).toHaveLength(0);
    const b = baselineReturns(series(0, 300, 0.001), [5], 500)[5];
    expect(b.length).toBeGreaterThan(400);
    expect(b.every((x) => x > 0)).toBe(true);
  });
});

describe("grade", () => {
  const t0 = Date.UTC(2026, 0, 1);
  const px = series(t0, 3000, 0.0005);
  const mk = (i: number, side: "long" | "short", missing = false): Receipt => ({
    id: `r${i}`, agentKey: "97:1", category: "trading", task: "t", startedAt: new Date(t0 + i * 120 * 60_000).toISOString(), completedAt: new Date(t0 + i * 120 * 60_000).toISOString(),
    inputs: [{ tool: "price", args: {}, provenance: missing ? "missing" : "live" }], reasoning: ["because"],
    decision: { kind: "practice_trade", symbol: "BNB", side, sizeUsd: 100, entryPrice: 100, horizonMin: 60, thesis: "up" }, cost: { usd: 0.01, wallMs: 1200 },
  });
  it("scores an agent that is always long on an up-trending series as high hit-rate but zero excess", () => {
    const receipts = Array.from({ length: 12 }, (_, i) => mk(i, "long"));
    const sc = grade("97:1", { receipts, prices: { BNB: px }, horizons: [60], baselineSamples: 500 });
    expect(sc.graded).toBe(12);
    const h = sc.horizons[0];
    expect(h.hitRate).toBe(1);
    expect(Math.abs(h.meanExcess)).toBeLessThan(1e-3);
    expect(sc.wilsonLower).toBeGreaterThan(0.7);
    expect(sc.honestyRate).toBe(1);
    expect(sc.score).not.toBeNull();
  });
  it("penalises decisions made on missing inputs and withholds a score below MIN_GRADED", () => {
    const receipts = [mk(0, "long", true), mk(1, "long"), mk(2, "short")];
    const sc = grade("97:1", { receipts, prices: { BNB: px }, horizons: [60], baselineSamples: 200 });
    expect(sc.honestyRate).toBeCloseTo(2 / 3, 5);
    expect(sc.score).toBeNull();
  });
  it("ignores receipts from other agents", () => {
    const sc = grade("97:2", { receipts: [mk(0, "long")], prices: { BNB: px } });
    expect(sc.receipts).toBe(0);
  });
});

describe("compositeScore", () => {
  it("is bounded and monotone in its inputs", () => {
    expect(compositeScore(1, 3, 1)).toBe(100);
    expect(compositeScore(0, -3, 1)).toBe(0);
    expect(compositeScore(0.6, null, 1)).toBeGreaterThan(compositeScore(0.6, null, 0.5));
    expect(compositeScore(0.6, 2, 1)).toBeGreaterThan(compositeScore(0.6, 0, 1));
  });
});
