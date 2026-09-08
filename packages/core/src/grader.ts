/**
 * Grader: turns receipts plus price history into a scorecard.
 *
 * Forward returns: enter at the open of the first candle at or after the decision time, exit at the
 * close of the candle at each horizon. Each event is compared with a baseline of random entries over
 * the same symbol's history, because a token that trended up makes every call look prescient. The
 * number that matters is the excess return and its t-statistic, not the raw return.
 */
import type { Receipt } from "./receipts";

export interface Candle { ts: number; open: number; close: number }
export type PriceSeries = Candle[];

export interface HorizonStats {
  horizonMin: number;
  n: number;
  meanRet: number;
  hitRate: number;
  meanExcess: number;
  medianExcess: number;
  tExcess: number | null;
}

export interface Scorecard {
  agentKey: string;
  receipts: number;
  practiceTrades: number;
  /** Receipts whose outcome was measured directly (replay or live follow-up) rather than derived from a price series. */
  resolvedOutcomes: number;
  graded: number;
  horizons: HorizonStats[];
  /** Wilson lower bound on hit rate at the primary horizon, 95% */
  wilsonLower: number | null;
  /** 1 minus the share of receipts that acted on missing or errored inputs */
  honestyRate: number;
  medianWallMs: number | null;
  totalCostUsd: number;
  /** 0..100 composite used for on-chain feedback; null until at least MIN_GRADED trades exist */
  score: number | null;
  primaryHorizonMin: number;
}

export const MIN_GRADED = 5;
const GAP_TOLERANCE_MS = 10 * 60 * 1000;

export function forwardReturns(px: PriceSeries, entryTs: number, horizons: number[]): { entryTs: number; entryPx: number; rets: Record<number, number | null> } | null {
  const i = lowerBound(px, entryTs);
  if (i >= px.length || px[i].ts - entryTs > GAP_TOLERANCE_MS) return null;
  const entry = px[i].open;
  const last = px[px.length - 1].ts;
  const rets: Record<number, number | null> = {};
  for (const h of horizons) {
    const target = px[i].ts + h * 60_000;
    if (target > last) { rets[h] = null; continue; }
    const j = upperBound(px, target) - 1;
    rets[h] = px[j].close / entry - 1;
  }
  return { entryTs: px[i].ts, entryPx: entry, rets };
}

export function baselineReturns(px: PriceSeries, horizons: number[], n: number, rng: () => number = mulberry32(7)): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const h of horizons) out[h] = [];
  if (px.length < 10) return out;
  const last = px[px.length - 1].ts;
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rng() * (px.length - 1));
    for (const h of horizons) {
      const target = px[i].ts + h * 60_000;
      if (target > last) continue;
      const j = upperBound(px, target) - 1;
      out[h].push(px[j].close / px[i].open - 1);
    }
  }
  return out;
}

export interface GradeInput {
  receipts: Receipt[];
  prices: Record<string, PriceSeries>;
  horizons?: number[];
  primaryHorizonMin?: number;
  baselineSamples?: number;
}

export function grade(agentKey: string, input: GradeInput): Scorecard {
  const horizons = input.horizons ?? [15, 60, 240, 1440];
  const primary = input.primaryHorizonMin ?? 60;
  const mine = input.receipts.filter((r) => r.agentKey === agentKey);
  const trades = mine.filter((r) => r.decision.kind === "practice_trade");

  const baseMean = new Map<string, number>();
  for (const [sym, px] of Object.entries(input.prices)) {
    const b = baselineReturns(px, horizons, input.baselineSamples ?? 2000);
    for (const h of horizons) if (b[h].length) baseMean.set(`${sym}:${h}`, mean(b[h]));
  }

  const perHorizon: Record<number, { ret: number[]; exc: number[]; win: boolean[] }> = {};
  for (const h of horizons) perHorizon[h] = { ret: [], exc: [], win: [] };
  let graded = 0;
  for (const r of trades) {
    if (r.decision.kind !== "practice_trade") continue;
    const px = input.prices[r.decision.symbol];
    if (!px) continue;
    const fr = forwardReturns(px, Date.parse(r.completedAt), horizons);
    if (!fr) continue;
    graded++;
    const sign = r.decision.side === "long" ? 1 : -1;
    for (const h of horizons) {
      const raw = fr.rets[h];
      if (raw === null || raw === undefined) continue;
      const ret = sign * raw;
      const bm = baseMean.get(`${r.decision.symbol}:${h}`);
      perHorizon[h].ret.push(ret);
      perHorizon[h].win.push(ret > 0);
      if (bm !== undefined) perHorizon[h].exc.push(ret - sign * bm);
    }
  }

  // A receipt can also arrive with its outcome already measured, by a replay over real history or
  // by a live follow-up. Those numbers are taken as given: an alert or a plan makes a claim that is
  // checkable on its own terms ("did recentring hold price in range longer", "did the ladder beat
  // holding"), and forcing it through a forward-return model would be the wrong measurement.
  const resolved = mine.filter((r) => r.outcome && typeof r.outcome.excessPct === "number");
  for (const r of resolved) {
    const o = r.outcome!;
    const h = o.horizonMin ?? primary;
    if (!perHorizon[h]) perHorizon[h] = { ret: [], exc: [], win: [] };
    graded++;
    perHorizon[h].ret.push(typeof o.returnPct === "number" ? o.returnPct : o.excessPct!);
    perHorizon[h].exc.push(o.excessPct!);
    perHorizon[h].win.push(o.correct ?? o.excessPct! > 0);
  }

  const allHorizons = [...new Set([...horizons, ...resolved.map((r) => r.outcome!.horizonMin ?? primary)])].sort((a, b) => a - b);
  const hs: HorizonStats[] = [];
  for (const h of allHorizons) {
    const { ret, exc, win } = perHorizon[h];
    if (ret.length === 0) continue;
    const n = exc.length;
    const sd = n > 1 ? std(exc) : NaN;
    const t = n > 1 && sd > 0 ? mean(exc) / (sd / Math.sqrt(n)) : null;
    hs.push({ horizonMin: h, n: ret.length, meanRet: mean(ret), hitRate: win.filter(Boolean).length / win.length, meanExcess: n ? mean(exc) : 0, medianExcess: n ? median(exc) : 0, tExcess: t });
  }

  const p = hs.find((x) => x.horizonMin === primary) ?? hs[0];
  const wilson = p ? wilsonLower(Math.round(p.hitRate * p.n), p.n) : null;
  const dishonest = mine.filter((r) => r.decision.kind !== "noop" && r.inputs.some((i) => i.provenance === "missing" || i.provenance === "error")).length;
  const honestyRate = mine.length ? 1 - dishonest / mine.length : 1;
  const walls = mine.map((r) => r.cost.wallMs).sort((a, b) => a - b);
  const score = p && p.n >= MIN_GRADED && wilson !== null ? compositeScore(wilson, p.tExcess, honestyRate) : null;

  return {
    agentKey, receipts: mine.length, practiceTrades: trades.length, resolvedOutcomes: resolved.length, graded, horizons: hs, wilsonLower: wilson, honestyRate,
    medianWallMs: walls.length ? walls[Math.floor(walls.length / 2)] : null, totalCostUsd: mine.reduce((s, r) => s + r.cost.usd, 0), score, primaryHorizonMin: primary,
  };
}

/** Wilson score interval lower bound, the same estimator TruthBounty uses for caller reputation. */
export function wilsonLower(successes: number, n: number, z = 1.96): number {
  if (n === 0) return 0;
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

/** 0..100. Hit-rate evidence carries most weight; a positive t-stat adds; dishonesty multiplies down. */
export function compositeScore(wilson: number, tExcess: number | null, honesty: number): number {
  const edge = tExcess === null ? 0 : Math.max(-1, Math.min(1, tExcess / 3));
  const raw = 70 * wilson + 30 * (0.5 + edge / 2);
  return Math.round(raw * honesty * 100) / 100;
}

function lowerBound(px: PriceSeries, ts: number): number { let lo = 0, hi = px.length; while (lo < hi) { const m = (lo + hi) >> 1; if (px[m].ts < ts) lo = m + 1; else hi = m; } return lo; }
function upperBound(px: PriceSeries, ts: number): number { let lo = 0, hi = px.length; while (lo < hi) { const m = (lo + hi) >> 1; if (px[m].ts <= ts) lo = m + 1; else hi = m; } return lo; }
function mean(a: number[]) { return a.reduce((s, x) => s + x, 0) / a.length; }
function std(a: number[]) { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); }
function median(a: number[]) { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function mulberry32(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
