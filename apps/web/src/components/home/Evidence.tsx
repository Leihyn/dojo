import Link from "next/link";
import { Eyebrow } from "./Chapters";
import { n, type HomeStats } from "./types";

function pctOf(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(2)}%` : "0%";
}

export function Evidence({ s }: { s: HomeStats }) {
  const total = s.live + s.gated + s.dead + s.unresolved;
  const segments: Array<[number, string, string]> = [
    [s.live, "bg-accent", "answer directly"],
    [s.gated, "bg-accent/40", "behind a gate"],
    [s.dead, "bg-critical", "dead"],
    [s.unresolved, "bg-ink/15", "unresolved"],
  ];
  return (
    <section aria-labelledby="evidence-title" className="hm-bleed hm-sec border-y border-line bg-paper">
      <div className="hm-wrap">
        <Eyebrow>What the checks found</Eyebrow>
        <h2 id="evidence-title" className="hm-h2"><span className="num">{n(s.indexed)}</span> agents indexed. <span className="hm-acc"><span className="num">{n(s.answering)}</span> answer.</span></h2>
        <p className="hm-lede">
          {s.registered != null ? <>Out of <span className="num">{n(s.registered)}</span> agents registered on BSC under ERC-8004, these</> : "These"} are the ones Dojo has indexed and called so far.
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="hm-stat hm-stat-hl"><b className="num">{n(s.answering)}</b><span>answer their endpoints: <span className="num">{n(s.live)}</span> directly, <span className="num">{n(s.gated)}</span> behind an auth or payment gate</span></div>
          <div className="hm-stat"><b className="num">{n(s.dead)}</b><span>dead: the endpoint exists in the file but does not respond</span></div>
          <div className="hm-stat"><b className="num">{n(s.unresolved)}</b><span>unresolved: nothing Dojo could call yet</span></div>
          <div className="hm-stat"><b className="num">{n(s.indexed)}</b><span>indexed so far, each with a recorded status and latency</span></div>
        </div>
        <div className="mt-7 flex h-3.5 overflow-hidden rounded-control bg-line" role="img" aria-label={`Of ${n(total)} indexed agents: ${segments.map(([c, , l]) => `${n(c)} ${l}`).join(", ")}`}>
          {segments.map(([c, bg, l]) => <i key={l} className={`block ${bg}`} style={{ width: pctOf(c, total) }} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
          {segments.map(([c, bg, l]) => (
            <li key={l} className="flex items-center gap-2"><span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-[3px] ${bg}`} /><span className="num">{n(c)}</span> {l}</li>
          ))}
        </ul>
        <Link href="/quality" className="hm-textlink mt-4">See the data quality report <span aria-hidden="true">&rarr;</span></Link>
      </div>
    </section>
  );
}
