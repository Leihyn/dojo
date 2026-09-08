"use client";
import { useState } from "react";
import type { CatalogEntry } from "@dojo/core";

export function ActivatePanel({ e }: { e: CatalogEntry }) {
  const [tab, setTab] = useState<"mcp" | "a2a" | "x402">(e.endpoints.mcp ? "mcp" : e.endpoints.a2a ? "a2a" : "x402");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mcpConfig = e.endpoints.mcp ? JSON.stringify({ mcpServers: { [slug(e.name)]: { url: e.endpoints.mcp } } }, null, 2) : null;

  async function payAndCall() {
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: e.key, task: "ping" }) });
      const j = await res.json();
      setResult(res.ok ? JSON.stringify(j, null, 2) : `${res.status}: ${j.error ?? "failed"}`);
    } catch (err) {
      setResult(String(err));
    } finally {
      setBusy(false);
    }
  }

  const tabs: Array<["mcp" | "a2a" | "x402", string, boolean]> = [["mcp", "Use in your IDE (MCP)", Boolean(e.endpoints.mcp)], ["a2a", "Call from another agent (A2A)", Boolean(e.endpoints.a2a)], ["x402", "Pay per call (x402)", true]];
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] p-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label, enabled]) => (
          <button key={k} disabled={!enabled} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-xs ${tab === k ? "bg-amber-400 text-black" : "border border-white/15 text-zinc-300"} disabled:cursor-not-allowed disabled:opacity-40`}>{label}</button>
        ))}
      </div>
      <div className="mt-4 text-sm text-zinc-300">
        {tab === "mcp" && mcpConfig && (
          <div>
            <p>Paste into Claude Desktop, Cursor or any MCP host. The server answered our initialize probe {e.probes.find((p) => p.kind === "mcp")?.state === "live" ? "successfully" : "with problems, see evidence above"}.</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs text-zinc-200">{mcpConfig}</pre>
          </div>
        )}
        {tab === "a2a" && e.endpoints.a2a && (
          <div>
            <p>Agent card for A2A clients:</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs text-zinc-200">{e.endpoints.a2a}</pre>
          </div>
        )}
        {tab === "x402" && (
          <div>
            <p>{e.x402 ? "This agent advertises x402 support." : "This agent does not advertise x402 support; the call below will only work for agents that answer a 402 challenge."} The marketplace pays from a testnet session wallet with a per-call cap, records a receipt, and grades the result.</p>
            <button onClick={payAndCall} disabled={busy} className="mt-3 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">{busy ? "Calling…" : "Pay & call (testnet)"}</button>
            {result && <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs text-zinc-200">{result}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}

function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agent"; }
