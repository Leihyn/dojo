/**
 * Replay runner: fetch real BNB/USDT history, replay the price-driven reference agents over it,
 * grade the receipts and write the scores into the catalog.
 *
 * Usage: pnpm replay -- --bars 2000 --interval 5m --horizon 240 --root ../..
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadBars, intervalMinutes } from "../prices";
import { replayGridPlanner, replayRangeKeeper } from "../replay";
import { ReceiptStore, type Receipt } from "../receipts";
import { grade, MIN_GRADED, type Scorecard } from "../grader";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); args.set(k, v ?? process.argv[++i] ?? "true"); }
}
const root = path.resolve(process.cwd(), args.get("root") ?? "../..");
const interval = args.get("interval") ?? "5m";
const barCount = Number(args.get("bars") ?? 2000);
const horizonMin = Number(args.get("horizon") ?? 240);
const symbol = args.get("symbol") ?? "BNBUSDT";
const intervalMin = intervalMinutes(interval);

const receiptsFile = path.resolve(root, args.get("receipts") ?? "data/receipts.jsonl");
const scorecardsFile = path.resolve(root, args.get("scorecards") ?? "data/scorecards.json");
const catalogFile = path.resolve(root, args.get("catalog") ?? "data/catalog.json");

console.log(`Fetching ${barCount} ${interval} bars of ${symbol}...`);
const bars = await loadBars(symbol, interval, barCount, { cacheDir: path.join(root, "data", "cache", "prices"), ttlSec: 1800 });
if (bars.length < 100) throw new Error(`only ${bars.length} bars returned; cannot replay`);
const span = (bars[bars.length - 1].ts - bars[0].ts) / 86_400_000;
console.log(`${bars.length} bars covering ${span.toFixed(1)} days, $${bars[0].close.toFixed(2)} -> $${bars[bars.length - 1].close.toFixed(2)}`);

const stepBars = Math.max(1, Math.round(Number(args.get("step-min") ?? 60) / intervalMin));
const common = { intervalMin, horizonMin, stepBars, symbol };

// Concentrated-liquidity positions on a 5bps major pair are narrow: a 20% band is never breached in
// a few hours, which makes "hold" trivially right and the score meaningless. 2% over a 12h-old
// position is the realistic case and the one worth grading.
const widthPct = Number(args.get("width") ?? 2);
const positionAgeBars = Math.max(1, Math.round(Number(args.get("age-min") ?? 720) / intervalMin));
const rangeReceipts = replayRangeKeeper(bars, { ...common, targetWidthPct: widthPct, positionAgeBars, agentKey: "97:dojo-range-keeper", agentName: "Dojo Range Keeper" });
const gridReceipts = replayGridPlanner(bars, { ...common, bandPct: Number(args.get("band") ?? 3), levels: Number(args.get("levels") ?? 9), agentKey: "97:dojo-grid-planner", agentName: "Dojo Grid Planner" });
const all: Receipt[] = [...rangeReceipts, ...gridReceipts];
console.log(`Replayed ${rangeReceipts.length} range-keeper (${widthPct}% range, ${positionAgeBars * intervalMin}m old) and ${gridReceipts.length} grid-planner decisions`);

// Rewrite rather than append: a replay over a given window is a function of that window, so two
// runs must not double-count the same decisions.
await mkdir(path.dirname(receiptsFile), { recursive: true });
await writeFile(receiptsFile, all.map((r) => JSON.stringify(r)).join("\n") + "\n");
const store = new ReceiptStore(receiptsFile);
const persisted = await store.readAll();

const scorecards: Record<string, Scorecard> = {};
for (const key of ["97:dojo-range-keeper", "97:dojo-grid-planner"]) {
  const sc = grade(key, { receipts: persisted, prices: {}, horizons: [horizonMin], primaryHorizonMin: horizonMin });
  scorecards[key] = sc;
  const h = sc.horizons[0];
  console.log(
    `\n${key}\n  receipts ${sc.receipts}, graded ${sc.graded}` +
    `\n  hit rate ${h ? (h.hitRate * 100).toFixed(1) : "-"}%  (Wilson lower ${sc.wilsonLower != null ? (sc.wilsonLower * 100).toFixed(1) : "-"}%)` +
    `\n  mean ${h ? (h.meanRet * 100).toFixed(2) : "-"}%  excess vs alternative ${h ? (h.meanExcess * 100).toFixed(2) : "-"}%  t ${h?.tExcess != null ? h.tExcess.toFixed(2) : "-"}` +
    `\n  honesty ${(sc.honestyRate * 100).toFixed(0)}%  score ${sc.score ?? `null (needs ${MIN_GRADED} graded)`}`
  );
}
// The metric each agent was measured on travels with the score, so the marketplace can never show a
// number without saying what it means.
const methods: Record<string, { metric: string; source: string; window: string }> = {
  "97:dojo-range-keeper": { metric: "time-in-range", source: `Binance ${symbol} ${interval} klines`, window: `${span.toFixed(1)} days to ${new Date(bars[bars.length - 1].ts).toISOString().slice(0, 10)}` },
  "97:dojo-grid-planner": { metric: "grid-pnl-vs-hold", source: `Binance ${symbol} ${interval} klines`, window: `${span.toFixed(1)} days to ${new Date(bars[bars.length - 1].ts).toISOString().slice(0, 10)}` },
};
const report = { builtAt: new Date().toISOString(), symbol, interval, bars: bars.length, spanDays: Number(span.toFixed(2)), horizonMin, rangeWidthPct: widthPct, scorecards, methods };
await writeFile(scorecardsFile, JSON.stringify(report, null, 2));
for (const extra of (args.get("copy-scorecards-to") ?? "apps/web/src/data/scorecards.json").split(",").filter(Boolean)) {
  const dest = path.resolve(root, extra);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(report, null, 2));
}

// Merge into the catalog so the marketplace ranks on these numbers.
let merged = 0;
try {
  const catalog = JSON.parse(await readFile(catalogFile, "utf8")) as { entries: Array<{ key: string; performance: Scorecard | null; seedMeta?: { ref?: string } }> };
  const byRef: Record<string, string> = { "range-keeper": "97:dojo-range-keeper", "grid-planner": "97:dojo-grid-planner" };
  for (const e of catalog.entries) {
    const target = byRef[e.seedMeta?.ref ?? ""] ?? (scorecards[e.key] ? e.key : undefined);
    if (!target || !scorecards[target]) continue;
    e.performance = { ...scorecards[target], agentKey: e.key };
    merged++;
  }
  await writeFile(catalogFile, JSON.stringify(catalog, null, 2));
  for (const extra of (args.get("copy-to") ?? "apps/web/src/data/catalog.json").split(",").filter(Boolean)) {
    const dest = path.resolve(root, extra);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify(catalog, null, 2));
  }
} catch (e) {
  console.log(`Catalog merge skipped: ${String(e)}`);
}
console.log(`\nWrote ${all.length} receipts to ${receiptsFile}`);
console.log(`Wrote scorecards to ${scorecardsFile}; merged into ${merged} catalog entries`);
