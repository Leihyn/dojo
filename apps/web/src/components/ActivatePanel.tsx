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

  const tabs: Array<["mcp" | "a2a" | "x402", string, boolean]> = [["mcp", "MCP", Boolean(e.endpoints.mcp)], ["a2a", "A2A", Boolean(e.endpoints.a2a)], ["x402", "x402", true]];
  return (
    <section aria-label="Connect to this agent" className="min-w-0 rounded-slip border border-line bg-paper px-6 py-5 shadow-slip">
      <div className="caps">Connect</div>
      <div role="tablist" aria-label="How to connect" className="mt-3 flex gap-1 rounded-control border border-line-strong p-1">
        {tabs.map(([k, label, enabled]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            disabled={!enabled}
            title={enabled ? undefined : `This agent advertises no ${label} endpoint`}
            onClick={() => setTab(k)}
            className={`min-h-[var(--hit)] flex-1 rounded-control px-2 text-sm font-medium transition-colors duration-[var(--dur-hover)] ease-out disabled:cursor-not-allowed disabled:opacity-50 ${tab === k ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4 text-sm text-ink-2">
        {tab === "mcp" && mcpConfig && (
          <div>
            <p>Paste into Claude Desktop, Cursor or any MCP host. The server {e.probes.find((p) => p.kind === "mcp")?.state === "live" ? "answered our initialize probe" : "had problems on our last probe; see the evidence"}.</p>
            <pre className="num mt-3 overflow-x-auto rounded-inset border border-line bg-paper-2 p-3 text-xs text-ink">{mcpConfig}</pre>
          </div>
        )}
        {tab === "a2a" && e.endpoints.a2a && (
          <div>
            <p>Agent card for A2A clients:</p>
            <pre className="num mt-3 overflow-x-auto rounded-inset border border-line bg-paper-2 p-3 text-xs text-ink">{e.endpoints.a2a}</pre>
          </div>
        )}
        {tab === "x402" && (
          <div>
            <p>{e.x402 ? "This agent advertises x402 support." : "This agent does not advertise x402 support; a call only works for agents that answer a 402 challenge."} Dojo would pay from a capped testnet session wallet, record a receipt, and grade the result.</p>
            <button onClick={payAndCall} disabled={busy} className="mt-3 h-[var(--control-h)] rounded-control bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-[var(--dur-hover)] ease-out hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Calling…" : "Pay & call (testnet)"}</button>
            {result && <pre className="num mt-3 overflow-x-auto whitespace-pre-wrap rounded-inset border border-line bg-paper-2 p-3 text-xs text-ink" aria-live="polite">{result}</pre>}
          </div>
        )}
      </div>
    </section>
  );
}

function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "agent"; }
