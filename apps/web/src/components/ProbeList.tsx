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
  if (probes.length === 0) return <p className="text-sm text-ink-2">The registration file advertises no endpoint, so there is nothing to call.</p>;
  return (
    <div>
      <ul className={`transition-opacity duration-[var(--dur-fast)] ease-out ${busy ? "opacity-50" : ""}`} aria-busy={busy}>
        {probes.map((p) => (
          <li key={p.kind + p.endpoint} className="border-t border-line py-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num w-10 shrink-0 text-xs font-semibold uppercase text-ink">{p.kind}</span>
              <StatusBadge state={p.state} />
              <span className="num text-xs text-ink-3">{ago(p.checkedAt)}{p.latencyMs != null ? ` · ${p.latencyMs} ms` : ""}{p.httpStatus ? ` · HTTP ${p.httpStatus}` : ""}</span>
            </div>
            <div className="num mt-1 break-all text-xs text-ink-2">{p.endpoint}</div>
            {(p.evidence || p.error) && <div className={`mt-1 text-xs ${p.error ? "text-critical" : "text-ok"}`}>{p.evidence ?? p.error}</div>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3" aria-live="polite">
        <button onClick={recheck} disabled={busy} className="h-[var(--control-h)] rounded-control border border-line-strong bg-paper px-4 text-sm font-medium text-ink transition-colors duration-[var(--dur-hover)] ease-out hover:bg-paper-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Checking…" : "Check again now"}
        </button>
        {error && <span className="text-xs text-critical">{error}</span>}
      </div>
    </div>
  );
}
