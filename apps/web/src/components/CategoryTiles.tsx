import Link from "next/link";
import type { CategoryCount } from "@/lib/catalog";

export function CategoryTiles({ counts }: { counts: CategoryCount[] }) {
  const core = counts.filter((c) => c.core);
  const rest = counts.filter((c) => !c.core && c.total > 0);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {core.map((c) => <Tile key={c.category} c={c} />)}
      </div>
      {rest.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Also listed</div>
          <div className="grid gap-3 sm:grid-cols-3">{rest.map((c) => <Tile key={c.category} c={c} small />)}</div>
        </div>
      )}
    </div>
  );
}

function Tile({ c, small }: { c: CategoryCount; small?: boolean }) {
  return (
    <Link href={`/agents?category=${c.category}`} className={`flex flex-col rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-amber-400/40 ${small ? "p-3" : "p-5"}`}>
      <div className={`font-semibold text-white ${small ? "text-sm" : "text-lg"}`}>{c.label}</div>
      <div className="mt-1 text-xs text-zinc-400">{c.blurb}</div>
      <div className="mt-4 flex items-baseline gap-3 font-mono text-xs text-zinc-500">
        <span><span className="text-xl text-white">{c.total}</span> listed</span>
        <span><span className="text-emerald-300">{c.live}</span> answering</span>
        <span><span className="text-amber-300">{c.graded}</span> graded</span>
      </div>
    </Link>
  );
}
