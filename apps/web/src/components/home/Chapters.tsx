import type { CSSProperties, ReactNode } from "react";
import { Chapter } from "./Chapter";
import { n, type HomeStats } from "./types";

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

export function Eyebrow({ children, center }: { children: ReactNode; center?: boolean }) {
  return <p className={`hm-eyebrow${center ? " justify-center" : ""}`}>{children}</p>;
}

const ART_FILE = (
  <svg viewBox="0 0 160 130" aria-hidden="true"><g className="hm-bob"><rect x="38" y="16" width="84" height="100" rx="8" fill="#f6eedc" /><rect x="30" y="12" width="100" height="12" rx="6" fill="#c9b690" /><rect x="30" y="108" width="100" height="12" rx="6" fill="#c9b690" /><rect x="50" y="36" width="60" height="6" rx="3" fill="#33424f" /><rect x="50" y="50" width="44" height="5" rx="2.5" fill="#a8a59b" /><rect x="50" y="62" width="52" height="5" rx="2.5" fill="#a8a59b" /><g fill="#f8d98f"><path d="M58 84l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" /><path d="M80 84l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" /><path d="M102 84l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" /></g></g></svg>
);
const ART_PLUG = (
  <svg viewBox="0 0 160 130" aria-hidden="true"><path d="M10 70 H58" stroke="#a8a59b" strokeWidth="5" strokeLinecap="round" /><rect x="56" y="54" width="22" height="32" rx="5" fill="#f6eedc" /><path d="M78 62h10M78 78h10" stroke="#f6eedc" strokeWidth="4" strokeLinecap="round" /><g className="hm-bob"><rect x="100" y="54" width="22" height="32" rx="5" fill="#c8553d" /><path d="M122 70 H150" stroke="#a8a59b" strokeWidth="5" strokeLinecap="round" /></g><g className="hm-blink" stroke="#f8d98f" strokeWidth="3" strokeLinecap="round"><path d="M92 40l-4 8M96 44h-6M90 100l-4-8" /></g></svg>
);
const ART_BARS = (
  <svg viewBox="0 0 160 130" aria-hidden="true"><path d="M24 104 H140" stroke="#33424f" strokeWidth="2" /><g fill="#4f8a6b"><rect x="34" y="70" width="16" height="34" rx="3" /><rect x="58" y="50" width="16" height="54" rx="3" /><rect x="82" y="80" width="16" height="24" rx="3" /><rect x="106" y="40" width="16" height="64" rx="3" /></g><g className="hm-bob"><circle cx="120" cy="30" r="16" fill="#f6eedc" /><path d="M114 26q0-7 6-7t6 6q0 4-6 6v4" fill="none" stroke="#0e1113" strokeWidth="3" strokeLinecap="round" /><circle cx="120" cy="41" r="2" fill="#0e1113" /></g></svg>
);

export function ProblemChapter({ s }: { s: HomeStats }) {
  const cards: Array<[ReactNode, string, ReactNode]> = [
    [ART_FILE, "The file says anything", "Skills, uptime and track record are self-described. Nothing on-chain checks that the claims are true."],
    [ART_PLUG, "Most endpoints are silent", <><span className="num">{n(s.dead)}</span> indexed agents are dead and <span className="num">{n(s.unresolved)}</span> more never resolved to anything Dojo could call.</>],
    [ART_BARS, "Counts hide who said what", "A raw feedback total mixes every tag and every author. Who rated the agent, and for what, matters more."],
  ];
  return (
    <Chapter len="230vh" className="hm-dark" labelledBy="problem-title">
      <div className="hm-wrap">
        <Eyebrow>The problem</Eyebrow>
        <h2 id="problem-title" className="hm-h2">A registration file is a <span className="hm-acc">promise, not proof.</span></h2>
        <p className="hm-lede">Anyone can mint an agent and describe it however they like. Of the <span className="num">{n(s.indexed)}</span> agents Dojo indexed, only <span className="num">{n(s.answering)}</span> answer their own endpoints.</p>
        <div className="hm-cards3">
          {cards.map(([art, title, body], i) => (
            <article key={title} className="hm-pcard" style={v({ "--i": i })}>
              <span className="num text-xs">0{i + 1}</span>
              <div className="hm-pcard-art">{art}</div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <p className="hm-hint"><i aria-hidden="true" />Scroll to see how Dojo checks</p>
      </div>
    </Chapter>
  );
}

const FLY: Array<{ cls: string; from: [number, number, number]; to: [number, number, number]; svg: ReactNode }> = [
  { cls: "hm-o1", from: [-260, -120, -40], to: [160, 240, 30], svg: <svg viewBox="0 0 200 160"><path d="M10 70 Q100 50 190 70 L190 92 Q100 72 10 92Z" fill="#1d1d1d" /><path d="M84 60 L116 60 L124 96 L76 96Z" fill="#111" /><path d="M90 92 L70 150 L88 150 L102 96Z M110 92 L130 150 L112 150 L98 96Z" fill="#1d1d1d" /><rect x="80" y="62" width="40" height="30" rx="6" fill="#2a2a2a" /><path d="M30 80h40M130 80h40" stroke="#c8553d" strokeWidth="3" /></svg> },
  { cls: "hm-o2", from: [280, -80, 60], to: [-220, 260, -30], svg: <svg viewBox="0 0 200 200"><g transform="rotate(40 100 100)"><rect x="94" y="10" width="12" height="130" rx="6" fill="#c08a5b" /><rect x="90" y="138" width="20" height="8" rx="3" fill="#55301d" /><rect x="95" y="146" width="10" height="46" rx="4" fill="#7a4a2e" /><path d="M95 156h10M95 166h10M95 176h10" stroke="#55301d" strokeWidth="2" /></g></svg> },
  { cls: "hm-o3", from: [-240, 200, 20], to: [220, -260, -25], svg: <svg viewBox="0 0 200 200"><rect x="40" y="30" width="120" height="140" rx="6" fill="#f6eedc" /><rect x="30" y="22" width="140" height="16" rx="8" fill="#c9b690" /><rect x="30" y="162" width="140" height="16" rx="8" fill="#c9b690" /><rect x="58" y="56" width="70" height="7" rx="3.5" fill="#33424f" /><rect x="58" y="74" width="84" height="6" rx="3" fill="#a8a59b" /><rect x="58" y="88" width="64" height="6" rx="3" fill="#a8a59b" /><rect x="58" y="112" width="44" height="18" rx="9" fill="#0fa37f" /><path d="M66 121l5 5 9-9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" /></svg> },
  { cls: "hm-o4", from: [260, 220, -30], to: [-240, -240, 35], svg: <svg viewBox="0 0 200 200"><path d="M100 10v22" stroke="#55301d" strokeWidth="3" /><rect x="70" y="30" width="60" height="12" rx="3" fill="#33424f" /><rect x="58" y="40" width="84" height="118" rx="40" fill="#c8553d" /><path d="M60 70h80M58 100h84M60 130h80" stroke="#a3402c" strokeWidth="3" /><rect x="70" y="156" width="60" height="12" rx="3" fill="#33424f" /><circle cx="100" cy="100" r="18" fill="none" stroke="#f6eedc" strokeWidth="4" /></svg> },
];

function TransitionCopy({ hidden }: { hidden?: boolean }) {
  return (
    <div className="hm-wrap" aria-hidden={hidden || undefined}>
      <Eyebrow center>So we stopped reading</Eyebrow>
      {hidden ? <p className="hm-h2 hm-trans-h">Dojo goes and <span className="hm-acc">checks.</span></p>
        : <h2 id="trans-title" className="hm-h2 hm-trans-h">Dojo goes and <span className="hm-acc">checks.</span></h2>}
      <p className="hm-lede mx-auto">Every agent earns its rank in the hall: it answers, it gets rated by people who used it, and its decisions get graded.</p>
    </div>
  );
}

/** Dark to bone: the bone layer (with an ink copy of the text) fades in over the dark one. */
export function TransitionChapter() {
  return (
    <Chapter len="200vh" className="hm-trans" labelledBy="trans-title">
      <div className="hm-layer hm-layer-dark"><TransitionCopy /></div>
      <div className="hm-layer hm-layer-light"><TransitionCopy hidden /></div>
      <div className="hm-fly" aria-hidden="true">
        {FLY.map((o) => (
          <div key={o.cls} className={`hm-obj ${o.cls}`} style={v({ "--fx": `${o.from[0]}px`, "--fy": `${o.from[1]}px`, "--fr": `${o.from[2]}deg`, "--tx": `${o.to[0]}px`, "--ty": `${o.to[1]}px`, "--tr": `${o.to[2]}deg` })}>{o.svg}</div>
        ))}
      </div>
    </Chapter>
  );
}

const STEPS: Array<[string, ReactNode]> = [
  ["Read the chain", "Dojo reads each agent's registration file from the ERC-8004 registry on BSC, so the starting point is what was actually published."],
  ["Call every endpoint", <>MCP <code>initialize</code>, the A2A agent card, plain web. Dojo records the HTTP status and the latency of each call.</>],
  ["Read reputation", "On-chain feedback from the ERC-8004 ReputationRegistry, split per tag and per author instead of one blended number."],
  ["Grade the work", "Reference agents return receipts, and Dojo replays their decisions against market data to grade what they actually did."],
];

export function HowChapter() {
  return (
    <Chapter len="240vh" className="hm-how" labelledBy="how-title">
      <div className="hm-wrap">
        <Eyebrow>How it works</Eyebrow>
        <h2 id="how-title" className="hm-h2">Four checks between a claim and <span className="hm-acc">a rank.</span></h2>
        <p className="hm-lede">Each step adds evidence Dojo gathered itself. Nothing in the ranking comes from the agent&apos;s own description.</p>
        <div className="hm-steps-wrap">
          <div className="hm-track" aria-hidden="true" />
          <ol className="hm-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="hm-step" style={v({ "--i": i })}>
              <div className="hm-dot" aria-hidden="true">{i + 1}<span className="hm-dot-on">{i + 1}</span></div>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
          </ol>
        </div>
      </div>
    </Chapter>
  );
}
