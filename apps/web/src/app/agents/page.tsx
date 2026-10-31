import Link from "next/link";
import { CATEGORIES, type Category } from "@dojo/core";
import { AgentLedger } from "@/components/AgentRow";
import { filterEntries } from "@/lib/catalog";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PAGE = 24;

export default async function AgentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = one(sp.category);
  const live = one(sp.live) === "1";
  const chainId = one(sp.chain) ? Number(one(sp.chain)) : undefined;
  const q = one(sp.q);
  const protocol = one(sp.protocol);
  const entries = filterEntries({ category, live, chainId, q, protocol });
  const pages = Math.max(1, Math.ceil(entries.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(one(sp.page)) || 1));
  const shown = entries.slice((page - 1) * PAGE, page * PAGE);
  // Any filter change returns to page 1; only the pager moves pages.
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { category, live: live ? "1" : undefined, chain: chainId ? String(chainId) : undefined, q, protocol, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/agents?${p}`;
  };
  const scope = [category ? CATEGORIES[category as Category]?.label ?? category : null, live ? "answering" : null, chainId === 56 ? "mainnet" : chainId === 97 ? "testnet" : null, protocol?.toUpperCase(), q ? `search "${q}"` : null].filter(Boolean).join(", ");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl text-ink">Agents</h1>
        <p className="mt-3 text-base text-ink-2">Ranked by evidence: answering endpoints first, then graded results, then on-chain feedback.</p>
      </div>

      <div className="space-y-3">
        <nav aria-label="Filter by job" className="flex flex-wrap gap-2">
          <Chip active={!category} href={link({ category: undefined })}>All jobs</Chip>
          {(Object.keys(CATEGORIES) as Category[]).map((c) => <Chip key={c} active={category === c} href={link({ category: c })}>{CATEGORIES[c].label}</Chip>)}
        </nav>
        <nav aria-label="Filter by evidence" className="flex flex-wrap gap-2">
          <Chip active={live} href={link({ live: live ? undefined : "1" })}>Answering only</Chip>
          <Chip active={chainId === 56} href={link({ chain: chainId === 56 ? undefined : "56" })}>Mainnet</Chip>
          <Chip active={chainId === 97} href={link({ chain: chainId === 97 ? undefined : "97" })}>Testnet</Chip>
          <Chip active={protocol === "mcp"} href={link({ protocol: protocol === "mcp" ? undefined : "mcp" })}>MCP</Chip>
          <Chip active={protocol === "a2a"} href={link({ protocol: protocol === "a2a" ? undefined : "a2a" })}>A2A</Chip>
        </nav>
        <form className="flex max-w-xl gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          {live && <input type="hidden" name="live" value="1" />}
          {/* Chain and protocol have to ride along too, or searching silently clears them. */}
          {chainId && <input type="hidden" name="chain" value={String(chainId)} />}
          {protocol && <input type="hidden" name="protocol" value={protocol} />}
          <label htmlFor="agents-q" className="sr-only">Search agents</label>
          <input id="agents-q" name="q" defaultValue={q} placeholder="Search by name, task or token id" className="h-[var(--control-h)] w-full min-w-0 rounded-control border border-line-strong bg-paper px-3 text-base text-ink placeholder:text-ink-3" />
          <button className="h-[var(--control-h)] shrink-0 rounded-control border border-line-strong bg-paper px-4 text-sm font-medium text-ink transition-colors duration-[var(--dur-hover)] ease-out hover:bg-paper-2">Search</button>
        </form>
      </div>

      <div className="num text-xs text-ink-3" aria-live="polite">
        <span className="text-ink">{entries.length}</span> agent{entries.length === 1 ? "" : "s"}{scope ? ` · ${scope}` : ""}{pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-slip border border-dashed border-line-strong p-8 text-center text-sm text-ink-2">
          No agent matches {scope || "these filters"}. <Link href="/agents" className="text-ink underline underline-offset-4">Clear filters</Link>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-slip border border-line bg-paper shadow-slip">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_110px_90px] gap-x-6 border-b border-line px-5 py-2 caps md:grid">
            <span>Agent</span><span>Probe</span><span className="text-right">On-chain</span><span className="text-right">Grade</span>
          </div>
          <AgentLedger entries={shown} label="Agents" />
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
          {page > 1 ? <Link href={pageLink(link, page - 1)} className="flex min-h-[var(--hit)] items-center rounded-control border border-line-strong bg-paper px-4 text-ink hover:bg-paper-2">Previous</Link> : <span />}
          <span className="num text-xs text-ink-3">{(page - 1) * PAGE + 1} to {Math.min(page * PAGE, entries.length)} of {entries.length}</span>
          {page < pages ? <Link href={pageLink(link, page + 1)} className="flex min-h-[var(--hit)] items-center rounded-control border border-line-strong bg-paper px-4 text-ink hover:bg-paper-2">Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

function pageLink(link: (p: Record<string, string | undefined>) => string, n: number) {
  return link({ page: n > 1 ? String(n) : undefined });
}

function Chip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex min-h-[var(--hit)] items-center rounded-control border px-3 text-sm transition-colors duration-[var(--dur-hover)] ease-out ${active ? "border-ink bg-ink text-paper" : "border-line-strong bg-paper text-ink-2 hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
