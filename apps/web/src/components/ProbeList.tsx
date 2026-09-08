"use client";
import { useState } from "react";
import type { Probe } from "@dojo/core";
import { StatusBadge } from "./StatusBadge";
import { ago } from "@/lib/format";

export function ProbeList({ initial }: { initial: Probe[] }) {
  const [probes, setProbes] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function recheck() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/probe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoints: Object.fromEntries(probes.map((p) => [p.kind, p.endpoint])) }) });
      const body = await res.json().catch(() => ({}));
      // The route refuses loopback and link-local targets, and several registered agents do
      // advertise 127.0.0.1. Saying so beats a button that looks broken.
      if (res.ok) setProbes(body.probes);
      else setError(typeof body.error === "string" ? body.error : `probe failed (HTTP ${res.status})`);
    } catch {
      setError("could not reach the probe endpoint");
    } finally {
      setBusy(false);
    }
  }
  if (probes.length === 0) return <p className="text-sm text-zinc-500">The registration file advertises no endpoint, so there is nothing to call.</p>;
  return (
    <div className="space-y-2">
      {probes.map((p) => (
        <div key={p.kind + p.endpoint} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] uppercase">{p.kind}</span>
            <StatusBadge state={p.state} />
            <span className="text-xs text-zinc-500">checked {ago(p.checkedAt)}{p.latencyMs != null ? ` · ${p.latencyMs} ms` : ""}{p.httpStatus ? ` · HTTP ${p.httpStatus}` : ""}</span>
          </div>
          <div className="mt-1 break-all font-mono text-xs text-zinc-400">{p.endpoint}</div>
          {(p.evidence || p.error) && <div className={`mt-1 text-xs ${p.error ? "text-rose-300/80" : "text-emerald-300/80"}`}>{p.evidence ?? p.error}</div>}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={recheck} disabled={busy} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:border-amber-400/50 disabled:opacity-50">
          {busy ? "Checking…" : "Check again now"}
        </button>
        {error && <span className="text-xs text-amber-300/80">{error}</span>}
      </div>
    </div>
  );
}
