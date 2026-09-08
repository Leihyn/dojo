import { getCatalog } from "@/lib/catalog";
import { ago } from "@/lib/format";

export default function QualityPage() {
  const c = getCatalog();
  const q = c.quality;
  const rows: Array<[string, number]> = [["Candidates enriched", q.candidates], ["Registration file resolves and parses", q.registrationOk], ["Registration file missing or broken", q.registrationFailed], ["Advertises an endpoint", q.withEndpoint], ["Endpoint answered", q.live], ["Endpoint answered with auth or payment gate", q.gated], ["Endpoint dead", q.dead], ["Endpoint unresolved (template or non-http)", q.unresolved]];
  return (
    <div className="max-w-3xl space-y-8">
      <div><h1 className="text-2xl font-semibold text-white">Data quality</h1><p className="mt-2 text-sm text-zinc-400">Every number on Dojo is derived from the chain or from a probe we ran. This page shows how much of the registry survives that test. Catalog built {c.builtAt ? ago(c.builtAt) : "never"}.</p></div>
      <table className="w-full text-sm"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-t border-white/10"><td className="py-2 text-zinc-300">{k}</td><td className="py-2 text-right font-mono text-white">{v}</td></tr>)}</tbody></table>
      {q.scanFailures && q.scanFailures.length > 0 && (
        <div className="rounded-md border border-amber-400/20 bg-amber-400/5 p-3">
          <h2 className="font-semibold text-amber-200">Coverage gaps in this build</h2>
          <p className="mt-1 text-xs text-amber-200/70">These registry filters did not answer when the catalog was built, so coverage is narrower than intended. Fewer agents here does not mean fewer agents exist.</p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-amber-200/60">{q.scanFailures.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      <div><h2 className="font-semibold text-white">Registry totals (8004scan)</h2><ul className="mt-2 grid gap-1 font-mono text-xs text-zinc-400 sm:grid-cols-2">{Object.entries(q.scanTotals).map(([k, v]) => <li key={k}>{k}: {v.toLocaleString()}</li>)}</ul></div>
      <div><h2 className="font-semibold text-white">Most common registration problems</h2><ul className="mt-2 space-y-1 text-xs text-zinc-400">{Object.entries(q.warnings).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => <li key={k}>{v} × {k}</li>)}</ul></div>
    </div>
  );
}
