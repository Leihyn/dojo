import Link from "next/link";
import { REF_AGENTS, type RefAgentName } from "@dojo/core";
import type { GradedAgent } from "@/lib/catalog";
import { Eyebrow } from "./Chapters";
import { n } from "./types";

export function primaryHorizon(g: GradedAgent) {
  return g.sc.horizons.find((x) => x.horizonMin === g.sc.primaryHorizonMin) ?? g.sc.horizons[0];
}

function GradeCard({ g }: { g: GradedAgent }) {
  const score = Math.round(g.sc.score ?? 0);
  const h = primaryHorizon(g);
  const good = score >= 50;
  const tryable = g.name in REF_AGENTS;
  return (
    <article className="flex flex-col gap-4 rounded-slip border border-line bg-paper p-7">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {g.method && <span className={`hm-tag${good ? "" : " hm-tag-warn"}`}>{g.method.metric}</span>}
          <h3 className="mt-3 text-2xl text-ink">{g.title}</h3>
        </div>
        <div className="hm-score" aria-label={`Score ${score} out of 100`}>{score}<small>/100</small></div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-control bg-line" aria-hidden="true"><i className={`block h-full rounded-control ${good ? "bg-accent" : "bg-critical"}`} style={{ width: `${score}%` }} /></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
        <dt className="text-ink-2">Decisions graded</dt><dd className="num font-medium">{n(g.sc.graded)}</dd>
        {h && <><dt className="text-ink-2">Hit rate at {h.horizonMin}m</dt><dd className="num font-medium">{(h.hitRate * 100).toFixed(1)}%</dd></>}
        {g.sc.wilsonLower != null && <><dt className="text-ink-2">95% lower bound</dt><dd className="num font-medium">{(g.sc.wilsonLower * 100).toFixed(0)}%</dd></>}
        {g.method && <><dt className="text-ink-2">Data</dt><dd className="font-medium">{g.method.source}, {g.method.window}</dd></>}
      </dl>
      <Link href={tryable ? `/try/${g.name as RefAgentName}` : "/quality"} className={`hm-pill ${good ? "hm-pill-ink" : "hm-pill-ghost"} self-start`}>
        {tryable ? `Try ${g.title}` : "See the quality page"} <span aria-hidden="true">&rarr;</span>
      </Link>
    </article>
  );
}

export function Graded({ graded }: { graded: GradedAgent[] }) {
  const m = graded.find((g) => g.method)?.method;
  const best = graded[0];
  const worst = graded[graded.length - 1];
  return (
    <section aria-labelledby="graded-title" className="hm-sec">
      <Eyebrow>Graded by replay</Eyebrow>
      <h2 id="graded-title" className="hm-h2">Scores are measured, <span className="hm-acc">even the bad ones.</span></h2>
      <p className="hm-lede">{m ? `Reference agents were replayed against ${m.source}, ${m.window}. ` : ""}Each decision was checked against what the market did next.</p>
      {graded.length === 0 ? (
        <p className="rounded-slip border border-dashed border-line-strong p-5 text-sm text-ink-2">No agent has enough graded runs yet, so there is no score to show.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">{graded.map((g) => <GradeCard key={g.key} g={g} />)}</div>
      )}
      {best && worst && best !== worst && (worst.sc.score ?? 0) < 50 && (
        <p className="mt-5 text-sm text-ink-2">A marketplace that only shows good scores is a brochure. Dojo publishes the {Math.round(worst.sc.score ?? 0)} next to the {Math.round(best.sc.score ?? 0)}.</p>
      )}
    </section>
  );
}
