import Link from "next/link";
import { CATEGORIES, type Category } from "@dojo/core";
import { AgentCard } from "@/components/AgentCard";
import { filterEntries } from "@/lib/catalog";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AgentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = one(sp.category);
  const live = one(sp.live) === "1";
  const chainId = one(sp.chain) ? Number(one(sp.chain)) : undefined;
  const q = one(sp.q);
  const protocol = one(sp.protocol);
  const entries = filterEntries({ category, live, chainId, q, protocol });
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { category, live: live ? "1" : undefined, chain: chainId ? String(chainId) : undefined, q, protocol, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/agents?${p}`;
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Chip active={!category} href={link({ category: undefined })}>All</Chip>
        {(Object.keys(CATEGORIES) as Category[]).map((c) => <Chip key={c} active={category === c} href={link({ category: c })}>{CATEGORIES[c].label}</Chip>)}
        <span className="mx-2 h-4 w-px bg-white/10" />
        <Chip active={live} href={link({ live: live ? undefined : "1" })}>Answering only</Chip>
        <Chip active={chainId === 56} href={link({ chain: chainId === 56 ? undefined : "56" })}>Mainnet</Chip>
        <Chip active={chainId === 97} href={link({ chain: chainId === 97 ? undefined : "97" })}>Testnet</Chip>
        <Chip active={protocol === "mcp"} href={link({ protocol: protocol === "mcp" ? undefined : "mcp" })}>MCP</Chip>
        <Chip active={protocol === "a2a"} href={link({ protocol: protocol === "a2a" ? undefined : "a2a" })}>A2A</Chip>
      </div>
      <form className="flex gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        {live && <input type="hidden" name="live" value="1" />}
        <input name="q" defaultValue={q} placeholder="Search" className="w-full max-w-md rounded-md border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white focus:border-amber-400/60 focus:outline-none" />
        <button className="rounded-md border border-white/15 px-3 py-1.5 text-sm">Search</button>
      </form>
      <div className="text-sm text-zinc-500">{entries.length} agent{entries.length === 1 ? "" : "s"}{category ? ` in ${CATEGORIES[category as Category]?.label ?? category}` : ""}{live ? ", answering" : ""}</div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-500">Nothing matches. Try clearing a filter.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{entries.map((e) => <AgentCard key={e.key} e={e} />)}</div>
      )}
    </div>
  );
}

function Chip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return <Link href={href} className={`rounded-full border px-3 py-1 ${active ? "border-amber-400 bg-amber-400 text-black" : "border-white/15 text-zinc-300 hover:border-white/40"}`}>{children}</Link>;
}
