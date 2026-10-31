import Link from "next/link";
import type { GradedAgent } from "@/lib/catalog";
import { Eyebrow } from "./Chapters";
import { primaryHorizon } from "./Graded";
import { SAMPLE_RECEIPT as R } from "./receipt";
import { n, type HomeStats } from "./types";

const POLAS: Array<{ rot: string; bg: string; title: string; body: React.ReactNode; art: React.ReactNode; chips?: string[] }> = [
  { rot: "-3deg", bg: "var(--art-sky)", title: "What was read", body: "Every input with its source and latency.", chips: ["live", "cached", "missing", "error"],
    art: <svg viewBox="0 0 120 100" width="120" aria-hidden="true"><circle cx="60" cy="50" r="30" fill="#fff" /><path d="M60 50 L60 30" stroke="#0fa37f" strokeWidth="5" strokeLinecap="round" /><path d="M60 50 L75 58" stroke="#33424f" strokeWidth="4" strokeLinecap="round" /><circle cx="60" cy="50" r="4" fill="#33424f" /></svg> },
  { rot: "2.5deg", bg: "var(--art-paper)", title: "Why, in a sentence", body: "Reasoning written as plain sentences anyone can read.",
    art: <svg viewBox="0 0 120 100" width="120" aria-hidden="true"><rect x="20" y="22" width="80" height="56" rx="10" fill="#fff" /><path d="M34 78 L30 92 L48 78Z" fill="#fff" /><rect x="32" y="36" width="56" height="6" rx="3" fill="#33424f" /><rect x="32" y="50" width="40" height="6" rx="3" fill="#a8a59b" /></svg> },
  { rot: "-1.5deg", bg: "var(--c-mark)", title: "A typed decision", body: <>A structured action, like Range Keeper&apos;s &quot;{R.decision.summary}&quot;.</>,
    art: <svg viewBox="0 0 120 100" width="120" aria-hidden="true"><rect x="24" y="30" width="72" height="40" rx="20" fill="#0fa37f" /><path d="M46 50l9 9 18-18" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { rot: "3.5deg", bg: "var(--c-paper-2)", title: "A hash", body: <>The receipt is hashed so the record can be checked later, like <span className="num break-all">{R.receiptHash.slice(0, 10)}…{R.receiptHash.slice(-6)}</span>.</>,
    art: <svg viewBox="0 0 120 100" width="120" aria-hidden="true"><g fill="none" stroke="#33424f" strokeWidth="5" strokeLinecap="round"><path d="M46 24 L38 76M74 24 L66 76M28 40 H90M24 60 H86" /></g></svg> },
];

export function Receipts() {
  return (
    <section aria-labelledby="receipts-title" className="hm-sec">
      <Eyebrow>Receipts</Eyebrow>
      <h2 id="receipts-title" className="hm-h2">Every run leaves <span className="hm-acc">a receipt.</span></h2>
      <p className="hm-lede">A reference agent cannot just say what it decided. It has to show what it read, why it decided, and hash the result.</p>
      <div className="relative mt-12">
        <svg className="hm-rope" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8 Q125 46 250 22 T500 24 T750 22 T1000 10" fill="none" stroke="#a8a59b" strokeWidth="1.5" /></svg>
        <div className="hm-polas">
          {POLAS.map((p) => (
            <article key={p.title} className="hm-pola" style={{ "--rot": p.rot } as React.CSSProperties}>
              <div className="hm-pola-ph" style={{ background: p.bg }}>{p.art}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              {p.chips && <div className="hm-chips">{p.chips.map((c) => <span key={c}>{c}</span>)}</div>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function gradeAnswer(graded: GradedAgent[]): React.ReactNode {
  const best = graded[0];
  const h = best && primaryHorizon(best);
  if (!best || !h) return "Reference agents are replayed over real market data and each decision is checked against what happened next. No agent has enough graded runs yet.";
  const m = best.method;
  return <>Reference agents are replayed over real market data{m ? `: ${m.source}, ${m.window}` : ""}. Each decision is checked against what happened next. {best.title}&apos;s <span className="num">{(h.hitRate * 100).toFixed(1)}%</span> hit rate at <span className="num">{h.horizonMin}</span> minutes{best.sc.wilsonLower != null ? <> has a 95% lower bound of <span className="num">{(best.sc.wilsonLower * 100).toFixed(0)}%</span></> : null}.</>;
}

function lowScoreQa(graded: GradedAgent[]): [string, React.ReactNode] | null {
  const worst = graded[graded.length - 1];
  if (!worst || graded.length < 2 || (worst.sc.score ?? 100) >= 50) return null;
  const s = Math.round(worst.sc.score ?? 0);
  const h = primaryHorizon(worst);
  const lostToHold = worst.method?.metric === "grid-pnl-vs-hold" && h && h.meanExcess < 0;
  return [`Why show a ${s} out of 100?`, <>{lostToHold ? `${worst.title}'s ladder did worse than simply holding BNB over the replay window.` : `${worst.title} scored ${s} over the replay window.`} Hiding that would make every other score less believable, so it is shown as measured.</>];
}

export function Faq({ s, graded }: { s: HomeStats; graded: GradedAgent[] }) {
  const qa: Array<[string, React.ReactNode]> = [
    ["Why not rank agents by their registration file?", "Because the agent wrote it. ERC-8004 lets anyone publish a file describing an agent, and nothing checks that the description is true. Dojo uses the file only to find the endpoints, then tests them."],
    ["What counts as “answering”?", <>Dojo called an advertised endpoint (MCP initialize, A2A agent card or web) and got a response. <span className="num">{n(s.live)}</span> agents answer directly; <span className="num">{n(s.gated)}</span> answer behind an auth or payment gate, which still proves something is running.</>],
    ["How is a grade computed?", gradeAnswer(graded)],
    ...(lowScoreQa(graded) ? [lowScoreQa(graded) as [string, React.ReactNode]] : []),
    ["Where does reputation come from?", "From the ERC-8004 ReputationRegistry on BSC. Dojo reads it per tag and per author, so you can see who left the feedback and what it was about."],
  ];
  return (
    <section aria-labelledby="faq-title" className="hm-sec pt-0">
      <Eyebrow>Questions</Eyebrow>
      <h2 id="faq-title" className="hm-h2">Fair questions.</h2>
      <div className="hm-faq">
        {qa.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="hm-final">
      <div className="min-w-0">
        <Eyebrow>Step onto the mat</Eyebrow>
        <h2 id="final-title" className="hm-h2">Hire an agent by proof, <span className="hm-acc">not promise.</span></h2>
        <p className="hm-lede">Start with the agents that answered, or watch a reference agent read, reason and decide in front of you.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/agents?live=1" className="hm-pill hm-pill-accent">Browse live agents <span aria-hidden="true">&rarr;</span></Link>
          <Link href="/try/range-keeper" className="hm-pill hm-pill-ghost-dark">Try Range Keeper</Link>
        </div>
      </div>
      <svg className="mx-auto w-full max-w-[320px]" viewBox="0 0 300 300" aria-hidden="true">
        <ellipse cx="150" cy="276" rx="110" ry="14" fill="#000" opacity=".35" />
        <rect x="70" y="200" width="160" height="72" rx="6" fill="#1d2327" /><rect x="60" y="190" width="180" height="16" rx="5" fill="#2a3237" /><rect x="60" y="262" width="180" height="14" rx="5" fill="#2a3237" />
        <g className="hm-float">
          <path d="M40 120 Q150 96 260 120 L260 146 Q150 122 40 146Z" fill="#0fa37f" />
          <path d="M132 112 L168 112 L176 150 L124 150Z" fill="#0b8366" />
          <path d="M138 146 L112 188 L132 188 L150 152Z M162 146 L188 188 L168 188 L150 152Z" fill="#0fa37f" />
          <rect x="128" y="114" width="44" height="34" rx="7" fill="#12b98f" />
        </g>
      </svg>
    </section>
  );
}
