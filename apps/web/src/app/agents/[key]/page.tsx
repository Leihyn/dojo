import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, chainConfig, reputationSummary } from "@dojo/core";
import { ActivatePanel } from "@/components/ActivatePanel";
import { ProbeList } from "@/components/ProbeList";
import { Scorecard } from "@/components/Scorecard";
import { StatusBadge } from "@/components/StatusBadge";
import { getEntry, gradingMethod } from "@/lib/catalog";
import { ago, chainName, shortAddr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const e = getEntry(decodeURIComponent(key));
  if (!e) notFound();
  const cfg = chainConfig(e.chainId);
  // Live read: the snapshot's reputation may be stale, the chain is not. Seed entries carry a slug
  // instead of a token id until they are registered on-chain, and BigInt() throws synchronously on
  // one, so guard before the call rather than trying to catch it.
  const onchainTokenId = /^\d+$/.test(e.tokenId) ? BigInt(e.tokenId) : null;
  const rep = onchainTokenId === null ? e.reputation : await reputationSummary(e.chainId, onchainTokenId).catch(() => e.reputation);
  return (
    <div className="space-y-8">
      <div className="text-xs text-zinc-500"><Link href="/agents" className="hover:text-white">Agents</Link> / <Link href={`/agents?category=${e.category}`} className="hover:text-white">{CATEGORIES[e.category].label}</Link></div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-white">{e.name}</h1>
          <p className="mt-2 text-zinc-400">{e.description || "No description in the registration file."}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>{chainName(e.chainId)} · token #{e.tokenId}</span>
            <a className="hover:text-white" href={`${cfg.explorer}/token/${cfg.identityRegistry}?a=${e.tokenId}`} target="_blank" rel="noreferrer">registry ↗</a>
            <span>owner {shortAddr(e.owner)}</span>
            <span>agent wallet {shortAddr(e.agentWallet)}</span>
            <a className="hover:text-white" href={`https://8004scan.io/agents/${e.chainId === 56 ? "bsc" : "bsc-testnet"}/${e.tokenId}`} target="_blank" rel="noreferrer">8004scan ↗</a>
          </div>
        </div>
        <StatusBadge state={e.liveStatus} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Section title="What it does" hint={`classified ${CATEGORIES[e.category].label} · confidence ${(e.classification.confidence * 100).toFixed(0)}%`}>
            <p className="text-sm text-zinc-300">{CATEGORIES[e.category].blurb}.</p>
            {e.classification.matched.length > 0 && <p className="mt-2 text-xs text-zinc-500">Evidence: {e.classification.matched.map((m) => m.split(":")[1]).join(", ")}</p>}
            {e.registration.warnings.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-amber-300/80">{e.registration.warnings.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
            )}
            {!e.registration.ok && <p className="mt-2 text-xs text-rose-300/80">Registration file could not be read: {e.registration.error}</p>}
          </Section>

          <Section title="Does it answer?" hint="probes run by Dojo, not self-reported">
            <ProbeList initial={e.probes} />
          </Section>

          <Section title="Graded performance" hint="measured outcomes, not self-reported">
            <Scorecard sc={e.performance} method={gradingMethod(e.key)} />
          </Section>
        </div>

        <aside className="space-y-6">
          <ActivatePanel e={e} />
          <Section title="On-chain reputation" hint="ERC-8004 ReputationRegistry, read live">
            <div className="font-mono text-sm text-zinc-300">
              <div>{rep.count} row{rep.count === 1 ? "" : "s"} from {rep.clients ?? "?"} wallet{rep.clients === 1 ? "" : "s"}</div>
              {rep.byTag && Object.keys(rep.byTag).length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs">{Object.entries(rep.byTag).map(([t, v]) => <li key={t}><span className="text-zinc-500">{t}</span> {v.mean.toFixed(1)} <span className="text-zinc-600">×{v.count}</span></li>)}</ul>
              ) : <div>{rep.value == null ? "no score" : `mean ${rep.value.toFixed(2)}`}</div>}
            </div>
            <p className="mt-2 text-xs text-zinc-500">Anyone can post feedback, and tags carry different units, so rows are shown per tag and per author rather than blended. Dojo posts graded scores here under the tag <span className="font-mono">dojo-graded</span> with a link to the receipts.</p>
          </Section>
          {e.scan && (
            <Section title="Indexer view" hint="8004scan">
              <div className="text-xs text-zinc-400">score {e.scan.totalScore ?? "–"} · health {e.scan.healthStatus ?? "unknown"} · endpoint {e.scan.endpointVerified ? "verified" : "unverified"} · {e.scan.feedbacks} feedbacks</div>
            </Section>
          )}
          <div className="text-[11px] text-zinc-600">Snapshot {ago(e.updatedAt)}. Registration URI: <span className="break-all font-mono">{e.registration.onchainUri ?? "none"}</span></div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between"><h2 className="font-semibold text-white">{title}</h2>{hint && <span className="text-[11px] text-zinc-500">{hint}</span>}</div>
      {children}
    </section>
  );
}
