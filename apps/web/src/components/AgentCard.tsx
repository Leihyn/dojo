import Link from "next/link";
import type { CatalogEntry } from "@dojo/core";
import { CATEGORIES } from "@dojo/core";
import { StatusBadge } from "./StatusBadge";
import { ago, chainName } from "@/lib/format";

export function AgentCard({ e }: { e: CatalogEntry }) {
  const lastProbe = e.probes.map((p) => p.checkedAt).sort().at(-1);
  const score = e.performance?.score;
  return (
    <Link href={`/agents/${encodeURIComponent(e.key)}`} className="group flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-amber-400/40 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-white group-hover:text-amber-300">{e.name}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">{CATEGORIES[e.category].label} · {chainName(e.chainId)} · #{e.tokenId}</div>
        </div>
        <StatusBadge state={e.liveStatus} title={lastProbe ? `checked ${ago(lastProbe)}` : undefined} />
      </div>
      <p className="line-clamp-2 text-sm text-zinc-400">{e.description || "No description in the registration file."}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>{e.protocols.length ? e.protocols.join(" · ") : "no endpoint"}</span>
        {e.x402 && <span className="text-amber-300/80">x402</span>}
        <span>{e.reputation.count} on-chain feedback{e.reputation.count === 1 ? "" : "s"}</span>
        {score != null ? <span className="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-300">graded {score.toFixed(0)}/100</span> : <span className="ml-auto text-zinc-600">ungraded</span>}
      </div>
    </Link>
  );
}
