"use client";
import { useState } from "react";

export function TryAgent({ name, sampleInput }: { name: string; sampleInput: Record<string, unknown> }) {
  const [input, setInput] = useState(JSON.stringify(sampleInput, null, 2));
  const [out, setOut] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const res = await fetch(`/api/ref/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: input });
      const j = await res.json();
      if (!res.ok) setErr(j.error ?? `HTTP ${res.status}`); else setOut(j);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }
  const receipt = out?.receipt as { reasoning?: string[]; inputs?: Array<{ tool: string; provenance: string; latencyMs?: number; note?: string }>; decision?: Record<string, unknown>; cost?: { wallMs: number } } | undefined;
  return (
    <div className="space-y-4">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={5} className="w-full rounded-md border border-white/15 bg-black/30 p-3 font-mono text-xs text-zinc-200 focus:border-amber-400/60 focus:outline-none" />
      <button onClick={run} disabled={busy} className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Running…" : "Run and get a receipt"}</button>
      {err && <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</div>}
      {out && receipt && (
        <div className="space-y-4">
          <section className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Decision</div>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-amber-200">{JSON.stringify(receipt.decision, null, 2)}</pre>
          </section>
          <section className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Reasoning</div>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-zinc-300">{receipt.reasoning?.map((r, i) => <li key={i}>{r}</li>)}</ol>
          </section>
          <section className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">What was read, with provenance · {receipt.cost?.wallMs} ms wall</div>
            <ul className="mt-1 space-y-1 font-mono text-xs text-zinc-400">{receipt.inputs?.map((c, i) => <li key={i}><span className={c.provenance === "live" ? "text-emerald-300" : c.provenance === "error" || c.provenance === "missing" ? "text-rose-300" : "text-zinc-300"}>{c.provenance}</span> {c.tool}{c.latencyMs != null ? ` ${c.latencyMs}ms` : ""}{c.note ? ` — ${c.note}` : ""}</li>)}</ul>
          </section>
          <section className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Result · receipt hash {String(out.receiptHash).slice(0, 18)}…</div>
            <pre className="mt-1 max-h-96 overflow-auto font-mono text-xs text-zinc-300">{JSON.stringify(out.result, null, 2)}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
