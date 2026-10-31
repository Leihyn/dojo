import { Row, Slip, SlipBody, SlipHead, Stub } from "@/components/Receipt";
import { getCatalog } from "@/lib/catalog";
import { ago } from "@/lib/format";

export default function QualityPage() {
  const c = getCatalog();
  const q = c.quality;
  const rows: Array<[string, number, boolean?]> = [["Candidates enriched", q.candidates], ["Registration file resolves and parses", q.registrationOk], ["Registration file missing or broken", q.registrationFailed], ["Advertises an endpoint", q.withEndpoint], ["Endpoint answered", q.live, true], ["Endpoint answered with auth or payment gate", q.gated], ["Endpoint dead", q.dead], ["Endpoint unresolved (template or non-http)", q.unresolved]];
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-4xl text-ink">Data quality</h1>
        <p className="mt-3 text-base text-ink-2">Every number on Dojo is derived from the chain or from a probe we ran. This page shows how much of the registry survives that test. Catalog built {c.builtAt ? ago(c.builtAt) : "never"}.</p>
      </div>
      <Slip label="Catalog build">
        <SlipHead eyebrow="This build" title="What survived the probe" />
        <SlipBody>{rows.map(([k, v, mark]) => <Row key={k} label={k} mark={mark}>{v}</Row>)}</SlipBody>
        <Stub left={c.builtAt ? `built ${c.builtAt.replace("T", " ").slice(0, 19)} UTC` : "never built"} right="pnpm index" />
      </Slip>
      {q.scanFailures && q.scanFailures.length > 0 && (
        <div className="rounded-slip border border-warn/40 bg-paper p-4">
          <h2 className="font-semibold text-warn">Coverage gaps in this build</h2>
          <p className="mt-1 text-xs text-ink-2">These registry filters did not answer when the catalog was built, so coverage is narrower than intended. Fewer agents here does not mean fewer agents exist.</p>
          <ul className="num mt-2 space-y-1 text-xs text-ink-2">{q.scanFailures.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      <section>
        <h2 className="text-lg font-semibold text-ink">Registry totals (8004scan)</h2>
        <div className="mt-2 grid gap-x-8 sm:grid-cols-2">{Object.entries(q.scanTotals).map(([k, v]) => <Row key={k} label={<span className="num">{k}</span>}>{v.toLocaleString()}</Row>)}</div>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">Most common registration problems</h2>
        <div className="mt-2">{Object.entries(q.warnings).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => <Row key={k} label={k}>{v}</Row>)}</div>
      </section>
    </div>
  );
}
