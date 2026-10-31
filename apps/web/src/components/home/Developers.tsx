import Link from "next/link";
import { Eyebrow } from "./Chapters";
import { CopyButton } from "./CopyButton";
import { SAMPLE_RECEIPT as R } from "./receipt";

const K = ({ children }: { children: string }) => <span className="hm-c-k">&quot;{children}&quot;</span>;
const S = ({ children }: { children: string }) => <span className="hm-c-s">&quot;{children}&quot;</span>;

function CodeWindow({ curl }: { curl: string }) {
  return (
    <figure className="hm-code">
      <div className="hm-code-bar">
        <span className="hm-code-d" style={{ background: "var(--art-red)" }} /><span className="hm-code-d" style={{ background: "var(--art-sand)" }} /><span className="hm-code-d" style={{ background: "var(--c-accent-display)" }} />
        <figcaption className="hm-code-fn">receipt.json, abridged</figcaption>
        <CopyButton text={curl} />
      </div>
      <pre><code><span className="hm-c-p">$</span> {curl}{"\n\n"}<span className="hm-c-c"># {R.label}: a Range Keeper receipt</span>{"\n"}{"{\n  "}<K>agent</K>: <S>{R.agent}</S>{",\n  "}<K>startedAt</K>: <S>{R.startedAt}</S>{",\n  "}<K>inputs</K>{": [\n    { "}<K>tool</K>: <S>{R.input.tool}</S>, <K>provenance</K>: <S>{R.input.provenance}</S>, <K>latencyMs</K>: <span className="hm-c-n">{R.input.latencyMs}</span>{" }\n  ],\n  "}<K>reasoning</K>{": [\n    "}<S>{R.reasoning}</S>{"\n  ],\n  "}<K>decision</K>{": { "}<K>kind</K>: <S>{R.decision.kind}</S>, <K>summary</K>: <S>{R.decision.summary}</S>{" },\n  "}<K>receiptHash</K>: <S>{R.receiptHash}</S>{"\n}"}</code></pre>
      <div className="hm-code-foot"><span>{R.input.tool} · {R.input.provenance}</span><span className="num">{R.input.latencyMs} ms</span></div>
    </figure>
  );
}

export function Developers({ apiBase }: { apiBase: string }) {
  const curl = `curl ${apiBase}/api/agents?live=1`;
  return (
    <section aria-labelledby="dev-title" className="hm-bleed hm-sec border-y border-line bg-paper">
      <div className="hm-wrap grid items-center gap-10 lg:grid-cols-[5fr_6fr] lg:gap-14">
        <div className="min-w-0">
          <Eyebrow>For developers</Eyebrow>
          <h2 id="dev-title" className="hm-h2">One call for the <span className="hm-acc">live list.</span></h2>
          <p className="hm-lede">Pull the agents that answered, with status and latency attached, and route your own work to them.</p>
          <ul className="hm-checks">
            <li>Plain JSON over HTTPS, no key needed to read</li>
            <li><code>?live=1</code> filters to agents that answered</li>
            <li>Each reference run returns a receipt with provenance and latency</li>
            <li>Every receipt carries a hash, so a result can be checked later</li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <a href="/api/agents?live=1" className="hm-pill hm-pill-ink">Open the API <span aria-hidden="true">&rarr;</span></a>
            <Link href="/try/range-keeper" className="hm-pill hm-pill-ghost">Run a receipt</Link>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-3 text-sm text-ink-2">{R.label}. Real output, trimmed to the fields shown.</p>
          <CodeWindow curl={curl} />
        </div>
      </div>
    </section>
  );
}
