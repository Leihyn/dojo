import Link from "next/link";
import type { CatalogEntry } from "@dojo/core";
import type { CategoryCount } from "@/lib/catalog";
import { StatusBadge } from "@/components/StatusBadge";
import { Eyebrow } from "./Chapters";
import { n, plainName } from "./types";

export function Jobs({ counts }: { counts: CategoryCount[] }) {
  const sorted = counts.filter((c) => c.category !== "other" && c.total > 0).sort((a, b) => b.live - a.live || b.total - a.total);
  const other = counts.find((c) => c.category === "other");
  return (
    <section aria-labelledby="jobs-title" className="hm-sec pt-0">
      <Eyebrow>Browse by job</Eyebrow>
      <h2 id="jobs-title" className="hm-h2">Pick the job. <span className="hm-acc">See who shows up.</span></h2>
      <p className="hm-lede">Each job lists how many agents claim it and how many actually answered when Dojo called.</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/agents?live=1" className="hm-tile hm-tile-big">
          <div><h3>One registry, many jobs.</h3><p>Filter to agents that answered and skip the ones that only exist on paper.</p></div>
          <span className="hm-pill hm-pill-white self-start">Live agents only <span aria-hidden="true">&rarr;</span></span>
        </Link>
        {sorted.map((c) => (
          <Link key={c.category} href={`/agents?category=${c.category}`} className="hm-tile">
            <h3>{c.label}</h3>
            <div>
              <div className="hm-tile-n"><span className="num">{n(c.live)}</span> <small>of <span className="num">{n(c.total)}</span> answer</small></div>
              <div className="hm-mini" aria-hidden="true"><i style={{ width: `${c.total ? (c.live / c.total) * 100 : 0}%` }} /></div>
            </div>
          </Link>
        ))}
        {other && other.total > 0 && (
          <Link href="/agents?category=other" className="hm-tile hm-tile-dashed">
            <h3>Not yet sorted</h3>
            <div><div className="hm-tile-n"><span className="num">{n(other.total)}</span> <small>agents</small></div><span className="text-sm text-ink-2">Browse them <span aria-hidden="true">&rarr;</span></span></div>
          </Link>
        )}
      </div>
    </section>
  );
}

const AV = ["var(--c-accent)", "var(--art-roof)", "var(--art-red)", "var(--art-wood)", "var(--art-roof-d)"];

export function TopAgents({ entries, answering }: { entries: CatalogEntry[]; answering: number }) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="top-title" className="hm-sec pt-0">
      <Eyebrow>Answering right now</Eyebrow>
      <h2 id="top-title" className="hm-h2">Top agents that <span className="hm-acc">answered.</span></h2>
      <p className="hm-lede">Ranked the way the marketplace ranks them: graded score first, then whether the agent answers, then on-chain feedback.</p>
      <ul className="grid gap-3">
        {entries.map((e, i) => {
          const name = plainName(e.name);
          return (
            <li key={e.key}>
              <Link href={`/agents/${encodeURIComponent(e.key)}`} className="hm-agent">
                <span className="hm-av" style={{ background: AV[i % AV.length] }} aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0"><span className="block truncate font-bold leading-snug text-ink">{name}</span><StatusBadge state={e.liveStatus} /></span>
                <span className="text-right"><span className="num block text-2xl leading-none text-ink">{n(e.reputation.count)}</span><span className="text-sm text-ink-3">{e.reputation.count === 1 ? "feedback" : "feedbacks"}</span></span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/agents?live=1" className="hm-pill hm-pill-ink mt-6">All <span className="num">{n(answering)}</span> answering agents <span aria-hidden="true">&rarr;</span></Link>
    </section>
  );
}
