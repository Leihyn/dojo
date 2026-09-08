/**
 * Price history for replay grading.
 *
 * Binance klines are the reference series for BNB/USDT: the PancakeSwap pools the reference agents
 * read track it closely, and Binance publishes a long, gap-free minute history without a key. Bars
 * are cached on disk keyed by symbol, interval and window, so a replay run is reproducible and a
 * second run costs no requests.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PriceSeries } from "./grader";

export interface Bar { ts: number; open: number; high: number; low: number; close: number }
export type BarSeries = Bar[];

/** api.binance.com first; data-api.binance.vision is the same data and answers where the main host is geo-blocked. */
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
const MAX_PER_REQUEST = 1000;

export interface FetchOpts {
  fetchImpl?: typeof fetch;
  /** Directory for the on-disk bar cache. Omit to skip caching entirely. */
  cacheDir?: string;
  /** Seconds a cache entry stays fresh. */
  ttlSec?: number;
}

/**
 * Fetch `limit` most recent bars, paging backwards because Binance caps a request at 1000.
 * Bars come back oldest-first with no duplicates.
 */
export async function fetchBars(symbol: string, interval: string, limit: number, opts: FetchOpts = {}): Promise<BarSeries> {
  const f = opts.fetchImpl ?? fetch;
  const out: BarSeries = [];
  let endTime: number | undefined;
  let guard = 0;
  while (out.length < limit && guard++ < 20) {
    const want = Math.min(MAX_PER_REQUEST, limit - out.length);
    const qs = new URLSearchParams({ symbol, interval, limit: String(want) });
    if (endTime !== undefined) qs.set("endTime", String(endTime));
    const rows = await getJson(`/api/v3/klines?${qs.toString()}`, f);
    if (!Array.isArray(rows) || rows.length === 0) break;
    const page: BarSeries = rows.map((r) => ({
      ts: Number((r as unknown[])[0]),
      open: Number((r as unknown[])[1]),
      high: Number((r as unknown[])[2]),
      low: Number((r as unknown[])[3]),
      close: Number((r as unknown[])[4]),
    })).filter((b) => Number.isFinite(b.ts) && Number.isFinite(b.open) && Number.isFinite(b.close));
    out.unshift(...page);
    endTime = page[0].ts - 1;
    if (page.length < want) break;
  }
  const seen = new Set<number>();
  return out.filter((b) => (seen.has(b.ts) ? false : (seen.add(b.ts), true))).sort((a, b) => a.ts - b.ts);
}

/** Bars with a disk cache. The cache key includes the window so a wider replay refetches rather than silently truncating. */
export async function loadBars(symbol: string, interval: string, limit: number, opts: FetchOpts = {}): Promise<BarSeries> {
  const ttl = (opts.ttlSec ?? 3600) * 1000;
  const file = opts.cacheDir ? path.join(opts.cacheDir, `${symbol}-${interval}-${limit}.json`) : null;
  if (file) {
    try {
      const raw = JSON.parse(await readFile(file, "utf8")) as { fetchedAt: number; bars: BarSeries };
      if (Date.now() - raw.fetchedAt < ttl && raw.bars.length >= Math.min(limit, 100)) return raw.bars;
    } catch { /* cold cache */ }
  }
  const bars = await fetchBars(symbol, interval, limit, opts);
  if (file && bars.length) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ fetchedAt: Date.now(), symbol, interval, bars }));
  }
  return bars;
}

/** The grader only needs open and close; high and low stay in BarSeries for path-dependent replays. */
export function toCandles(bars: BarSeries): PriceSeries {
  return bars.map((b) => ({ ts: b.ts, open: b.open, close: b.close }));
}

export function intervalMinutes(interval: string): number {
  const m = /^(\d+)([mhdw])$/.exec(interval);
  if (!m) throw new Error(`unsupported interval ${interval}`);
  const n = Number(m[1]);
  return n * ({ m: 1, h: 60, d: 1440, w: 10080 }[m[2] as "m" | "h" | "d" | "w"]);
}

async function getJson(pathname: string, f: typeof fetch): Promise<unknown> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await f(`${host}${pathname}`, { headers: { accept: "application/json" } });
      if (!res.ok) { lastErr = new Error(`${host} ${res.status}`); continue; }
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw new Error(`klines fetch failed: ${String(lastErr)}`);
}
