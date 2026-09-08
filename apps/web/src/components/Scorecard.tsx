import type { Scorecard as SC } from "@dojo/core";
import { pct } from "@/lib/format";

/** What each agent's number actually measures. A score with no stated metric is the kind of claim this marketplace exists to replace. */
const METRICS: Record<string, { unit: "pct" | "share"; ret: string; excess: string; note: string }> = {
  "time-in-range": {
    unit: "share",
    ret: "time in range",
    excess: "vs the alternative",
    note: "Each decision is scored on the share of the next window the price spent inside the range the agent chose, against the range it rejected. Ties count for holding, because a rebalance costs gas.",
  },
  "grid-pnl-vs-hold": {
    unit: "pct",
    ret: "ladder P&L",
    excess: "vs buy and hold",
    note: "Each plan is walked bar by bar, filling a level whenever the close crosses it and paying 25bps a fill, then compared with putting the same budget into BNB and holding.",
  },
  default: { unit: "pct", ret: "mean ret", excess: "excess vs random", note: "Decisions are scored against forward price returns and compared with random entries on the same asset." },
};

export function Scorecard({ sc, method }: { sc: SC | null; method?: { metric?: string; source?: string; window?: string; receipts?: number } }) {
  if (!sc || sc.graded === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-zinc-400">
        <div className="font-medium text-zinc-300">No graded runs yet</div>
        <p className="mt-1">A score appears only after this agent has produced receipts through the marketplace and at least five of its decisions have been graded against a measurable outcome. Registry reputation and the agent&apos;s own claims never substitute for this.</p>
      </div>
    );
  }
  const m = METRICS[method?.metric ?? ""] ?? METRICS.default;
  const fmt = (x: number) => (m.unit === "share" ? `${(x * 100).toFixed(1)}%` : pct(x));
  return (
    <div className="space-y-3">
      {method?.source && (
        <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
          <span className="font-medium text-amber-200">Replay-graded, not a live track record.</span>{" "}
          {sc.graded} decisions replayed over {method.window ?? "real price history"} from {method.source}. {m.note}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Graded score" value={sc.score != null ? `${sc.score.toFixed(0)} / 100` : "pending"} hint={sc.score == null ? `needs ${5 - sc.graded} more graded runs` : "Wilson hit-rate bound, excess t-stat, honesty"} />
        <Stat label="Hit rate (lower bound)" value={sc.wilsonLower != null ? `${(sc.wilsonLower * 100).toFixed(0)}%` : "–"} hint="95% Wilson lower bound" />
        <Stat label="Honesty" value={`${(sc.honestyRate * 100).toFixed(0)}%`} hint="runs that did not act on missing data" />
        <Stat label="Graded decisions" value={String(sc.graded)} hint={`${sc.receipts} receipts, $${sc.totalCostUsd.toFixed(2)} total`} />
      </div>
      <table className="w-full text-xs">
        <thead className="text-zinc-500"><tr><th className="py-1 text-left font-normal">Horizon</th><th className="text-right font-normal">n</th><th className="text-right font-normal">{m.ret}</th><th className="text-right font-normal">hit</th><th className="text-right font-normal">{m.excess}</th><th className="text-right font-normal">t</th></tr></thead>
        <tbody className="font-mono text-zinc-300">
          {sc.horizons.map((h) => (
            <tr key={h.horizonMin} className="border-t border-white/5"><td className="py-1">{h.horizonMin}m</td><td className="text-right">{h.n}</td><td className="text-right">{fmt(h.meanRet)}</td><td className="text-right">{(h.hitRate * 100).toFixed(0)}%</td><td className={`text-right ${h.meanExcess < 0 ? "text-rose-300" : "text-emerald-300"}`}>{fmt(h.meanExcess)}</td><td className="text-right">{h.tExcess == null ? "–" : h.tExcess.toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-lg text-white">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}
