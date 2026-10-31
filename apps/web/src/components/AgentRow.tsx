import Link from "next/link";
import type { CatalogEntry } from "@dojo/core";
import { CATEGORIES } from "@dojo/core";
import { StatusBadge } from "./StatusBadge";
import { ago, chainName, protocolList } from "@/lib/format";

/** One ledger line per agent. Names wrap at word boundaries instead of being cut mid-word. */
export function AgentRow({ e }: { e: CatalogEntry }) {
  const lastProbe = e.probes.map((p) => p.checkedAt).sort().at(-1);
  const score = e.performance?.score;
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/agents/${encodeURIComponent(e.key)}`}
        className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 px-5 py-3 transition-colors duration-[var(--dur-hover)] ease-out hover:bg-paper-2 md:grid-cols-[minmax(0,1fr)_150px_110px_90px] md:items-baseline"
      >
        <div className="min-w-0">
          <div className="line-clamp-2 font-medium text-ink">{e.name}</div>
          <div className="mt-0.5 text-xs text-ink-3">
            {CATEGORIES[e.category].label} · {chainName(e.chainId)} · <span className="num">#{e.tokenId}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 md:block">
          <StatusBadge state={e.liveStatus} title={lastProbe ? `checked ${ago(lastProbe)}` : undefined} />
          <span className="text-xs text-ink-3 md:mt-0.5 md:block">{protocolList(e.protocols) || "no endpoint"}{e.x402 ? " · x402" : ""}</span>
        </div>
        <div className="num text-xs text-ink-2 md:text-right">{e.reputation.count} feedback{e.reputation.count === 1 ? "" : "s"}</div>
        <div className="num text-xs md:text-right">{score != null ? <span className="mark">{score.toFixed(0)}/100</span> : <span className="text-ink-3">ungraded</span>}</div>
      </Link>
    </li>
  );
}

export function AgentLedger({ entries, label }: { entries: CatalogEntry[]; label: string }) {
  return (
    <ul aria-label={label} className="min-w-0">
      {entries.map((e) => <AgentRow key={e.key} e={e} />)}
    </ul>
  );
}
