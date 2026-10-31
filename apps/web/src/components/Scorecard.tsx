import type { Scorecard as SC } from "@dojo/core";
import { pct } from "@/lib/format";
import { Row } from "./Receipt";

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
      <div className="text-sm text-ink-2">
        <div className="font-medium text-ink">No graded runs yet</div>
        <p className="mt-1">A score appears only after this agent has produced receipts through the marketplace and at least five of its decisions have been graded against a measurable outcome. Registry reputation and the agent&apos;s own claims never substitute for this.</p>
      </div>
    );
  }
  const m = METRICS[method?.metric ?? ""] ?? METRICS.default;
  const fmt = (x: number) => (m.unit === "share" ? `${(x * 100).toFixed(1)}%` : pct(x));
  return (
    <div className="space-y-4">
      {method?.source && (
        <p className="text-xs text-ink-2">
          <span className="font-medium text-ink">Replay-graded, not a live track record.</span>{" "}
          {sc.graded} decisions replayed over {method.window ?? "real price history"} from {method.source}. {m.note}
        </p>
      )}
      <div>
        <Row label="Graded score" mark={sc.score != null} sub={sc.score == null ? `needs ${5 - sc.graded} more graded runs` : "Wilson hit-rate bound, excess t-stat, honesty"}>{sc.score != null ? `${sc.score.toFixed(0)} / 100` : "pending"}</Row>
        <Row label="Hit rate, 95% lower bound">{sc.wilsonLower != null ? `${(sc.wilsonLower * 100).toFixed(0)}%` : "none"}</Row>
        <Row label="Runs that did not act on missing data">{(sc.honestyRate * 100).toFixed(0)}%</Row>
        <Row label="Graded decisions" sub={`${sc.receipts} receipts, $${sc.totalCostUsd.toFixed(2)} total`}>{sc.graded}</Row>
      </div>
      <div className="overflow-x-auto">
        <table className="num w-full min-w-[420px] text-xs">
          <thead className="text-ink-3"><tr><th className="py-1 text-left font-normal">Horizon</th><th className="text-right font-normal">n</th><th className="text-right font-normal">{m.ret}</th><th className="text-right font-normal">hit</th><th className="text-right font-normal">{m.excess}</th><th className="text-right font-normal">t</th></tr></thead>
          <tbody className="text-ink">
            {sc.horizons.map((h) => (
              <tr key={h.horizonMin} className="border-t border-line"><td className="py-1">{h.horizonMin}m</td><td className="text-right">{h.n}</td><td className="text-right">{fmt(h.meanRet)}</td><td className="text-right">{(h.hitRate * 100).toFixed(0)}%</td><td className={`text-right ${h.meanExcess < 0 ? "text-critical" : "text-ok"}`}>{fmt(h.meanExcess)}</td><td className="text-right">{h.tExcess == null ? "none" : h.tExcess.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
