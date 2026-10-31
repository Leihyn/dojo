"use client";
import { useState } from "react";
import { Row, Slip, SlipBody, SlipHead, Stub } from "./Receipt";

interface Read { tool: string; provenance: string; latencyMs?: number; note?: string }
interface ReceiptShape { reasoning?: string[]; inputs?: Read[]; decision?: Record<string, unknown>; cost?: { wallMs: number } }

const PROVENANCE: Record<string, string> = { live: "text-ok", cached: "text-ink-2", missing: "text-critical", error: "text-critical" };

export function TryAgent({ name, title, sampleInput }: { name: string; title: string; sampleInput: Record<string, unknown> }) {
  const [input, setInput] = useState(JSON.stringify(sampleInput, null, 2));
  const [out, setOut] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);
  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const res = await fetch(`/api/ref/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: input });
      const j = await res.json();
      if (!res.ok) setErr(j.error ?? `HTTP ${res.status}`); else { setOut(j); setRanAt(new Date().toISOString()); }
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }
  const receipt = out?.receipt as ReceiptShape | undefined;
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <div className="min-w-0 space-y-3">
        <label htmlFor="try-input" className="caps block">Input</label>
        <p className="text-xs text-ink-3">Prefilled with a real example. Edit any field; the agent reads live BNB Smart Chain state.</p>
        <textarea id="try-input" value={input} onChange={(e) => setInput(e.target.value)} rows={7} spellCheck={false} className="num w-full rounded-inset border border-line-strong bg-paper p-3 text-base text-ink" aria-describedby={err ? "try-error" : undefined} />
        <button onClick={run} disabled={busy} className="h-[var(--control-h)] rounded-control bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-[var(--dur-hover)] ease-out hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Running…" : "Run and get a receipt"}</button>
        {err && <p id="try-error" role="alert" className="text-sm text-critical">The agent refused this input: {err}. Fix the input and run again.</p>}
      </div>

      <div className="min-w-0" aria-live="polite">
        {busy ? <PrintingSlip /> : out && receipt ? (
          <Slip label={`Receipt from ${title}`}>
            <SlipHead eyebrow="Receipt" title={title} />
            <SlipBody className="space-y-4">
              <div>
                <div className="caps">Decision</div>
                <p className="mt-1 text-sm"><span className="mark">{decisionLine(receipt.decision)}</span></p>
                {decisionRows(receipt.decision).map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}
              </div>
              <div>
                <div className="caps">What was read</div>
                {receipt.inputs?.map((c, i) => (
                  <Row key={i} label={<span className="num">{c.tool}</span>} sub={c.note}>
                    <span className={PROVENANCE[c.provenance] ?? "text-ink"}>{c.provenance}</span>{c.latencyMs != null ? <span className="text-ink-3"> {c.latencyMs} ms</span> : null}
                  </Row>
                ))}
              </div>
              <div>
                <div className="caps">Reasoning</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink-2">{receipt.reasoning?.map((r, i) => <li key={i}>{r}</li>)}</ol>
              </div>
              <details className="text-xs">
                <summary className="flex min-h-[var(--hit)] cursor-pointer items-center text-ink-2 hover:text-ink">Full result</summary>
                <pre className="num max-h-96 overflow-auto rounded-inset border border-line bg-paper-2 p-3 text-ink">{JSON.stringify(out.result, null, 2)}</pre>
              </details>
            </SlipBody>
            <Stub left={`hash ${String(out.receiptHash)}`} right={`${receipt.cost?.wallMs ?? "?"} ms · ${ranAt ? new Date(ranAt).toISOString().slice(11, 19) : ""} UTC`} />
          </Slip>
        ) : <SampleSlip />}
      </div>
    </div>
  );
}

function decisionLine(d: Record<string, unknown> | undefined): string {
  if (!d) return "no decision";
  return String(d.summary ?? d.message ?? d.kind ?? "decision");
}

function decisionRows(d: Record<string, unknown> | undefined): Array<[string, string]> {
  if (!d) return [];
  return Object.entries(d).filter(([k, v]) => !["summary", "message"].includes(k) && (typeof v === "string" || typeof v === "number")).map(([k, v]) => [k, String(v)]);
}

/** Before the first run: what a receipt is, part by part. Labelled as a sample so it is never mistaken for a result. */
function SampleSlip() {
  return (
    <Slip label="Sample receipt">
      <SlipHead eyebrow="Sample, not a result" title="What you get back" />
      <SlipBody className="space-y-3 text-sm text-ink-2">
        <Row label="Decision" mark>what the agent concluded</Row>
        <Row label="Reads">every chain or API call</Row>
        <Row label="Provenance">live, cached, missing, error</Row>
        <Row label="Reasoning">plain sentences</Row>
        <p className="text-xs text-ink-3">If the agent acts on a missing or errored read, the receipt says so, and that run counts against its honesty score.</p>
      </SlipBody>
      <Stub left="hash of the whole receipt" right="time and wall ms" />
    </Slip>
  );
}

/** Loading: a slip skeleton shaped like the receipt it will become. */
function PrintingSlip() {
  return (
    <Slip label="Printing receipt">
      <SlipHead eyebrow="Running against BNB Smart Chain" title="Printing…" />
      <SlipBody className="space-y-3">
        {[70, 92, 84, 60, 88].map((w, i) => <div key={i} className="h-3 rounded-control bg-paper-2" style={{ width: `${w}%` }} />)}
      </SlipBody>
      <Stub left="hash pending" />
    </Slip>
  );
}
