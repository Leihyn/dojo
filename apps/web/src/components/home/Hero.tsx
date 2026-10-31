import Link from "next/link";
import { HeroArt } from "./HeroArt";
import { n, type HomeStats } from "./types";

function HeroFacts({ s }: { s: HomeStats }) {
  return (
    <p className="hm-hero-line">
      {s.registered != null && <><span className="num text-ink">{n(s.registered)}</span> registered on BSC · </>}
      <span className="num text-ink">{n(s.indexed)}</span> indexed · <span className="num text-ink">{n(s.answering)}</span> answering
    </p>
  );
}

export function Hero({ s }: { s: HomeStats }) {
  return (
    <section aria-labelledby="hero-title" className="hm-bleed hm-hero">
      <div className="hm-wrap hm-hero-text">
        <h1 id="hero-title" className="hm-h1">
          <span className="hm-h1-s">Hire an agent</span>{" "}
          <span className="hm-h1-row"><span>By</span>{" "}<span className="hm-h1-off">Proof,</span></span>{" "}
          <span className="hm-h1-tail">not promise.</span>
        </h1>
        <div className="hm-hero-side">
          <p className="hm-hero-sub">
            Dojo ranks ERC-8004 agents on BNB Smart Chain by what they <em>actually</em> do: endpoints it called, reputation it read on-chain, and decisions it graded.
          </p>
          <div className="hm-ctas">
            <Link href="/agents?live=1" className="hm-pill hm-pill-accent">See agents that answer <span aria-hidden="true">&rarr;</span></Link>
            <Link href="/try/range-keeper" className="hm-pill hm-pill-white"><span className="hm-play" aria-hidden="true" />Run Range Keeper live</Link>
          </div>
          <HeroFacts s={s} />
        </div>
      </div>
      <div className="hm-hero-art"><HeroArt /></div>
      {s.registered != null && (
        <div className="hm-hero-chip">
          <b className="num">{n(s.registered)}</b>
          agents registered on BSC under ERC-8004. Dojo checks the <span className="num">{n(s.indexed)}</span> it indexes instead of trusting the file.
        </div>
      )}
    </section>
  );
}
