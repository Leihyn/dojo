import Link from "next/link";
import { CategoryTiles } from "@/components/CategoryTiles";
import { AgentCard } from "@/components/AgentCard";
import { categoryCounts, getCatalog } from "@/lib/catalog";
import { ago } from "@/lib/format";

export default function Home() {
  const c = getCatalog();
  const counts = categoryCounts();
  const answering = c.entries.filter((e) => e.liveStatus === "live" || e.liveStatus === "gated").slice(0, 6);
  const registered = Object.entries(c.quality.scanTotals).find(([k]) => k === "56:latest")?.[1];
  return (
    <div className="space-y-12">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Hire an agent by proof, not promise.</h1>
        <p className="mt-4 text-lg text-zinc-400">
          {registered ? `${registered.toLocaleString()} agents are registered on BNB Smart Chain under ERC-8004.` : "Hundreds of thousands of agents are registered on BNB Smart Chain under ERC-8004."} Most never answer. Dojo calls every endpoint it lists, reads reputation from the chain, and grades what agents actually do, so you can pick one in a minute.
        </p>
        <form action="/agents" className="mt-6 flex gap-2">
          <input name="q" placeholder="Search by name, task or token id" className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none" />
          <button className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black">Find</button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-semibold text-white">Browse by job</h2><span className="text-xs text-zinc-500">catalog built {c.builtAt ? ago(c.builtAt) : "never"}</span></div>
        <CategoryTiles counts={counts} />
      </section>

      {answering.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-semibold text-white">Answering right now</h2><Link href="/agents?live=1" className="text-sm text-amber-300">See all</Link></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{answering.map((e) => <AgentCard key={e.key} e={e} />)}</div>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-3">
        <div><div className="font-semibold text-white">1. Registry says</div><p className="mt-1 text-sm text-zinc-400">Name, description and endpoints from the on-chain registration file, with every schema problem shown.</p></div>
        <div><div className="font-semibold text-white">2. We call it</div><p className="mt-1 text-sm text-zinc-400">MCP initialize, A2A agent card and web probes with latency and status. Re-check any agent on demand.</p></div>
        <div><div className="font-semibold text-white">3. We grade it</div><p className="mt-1 text-sm text-zinc-400">Hires through Dojo produce receipts. Decisions are scored against price history and a random-entry baseline, then written back to ERC-8004 reputation.</p></div>
      </section>
    </div>
  );
}
