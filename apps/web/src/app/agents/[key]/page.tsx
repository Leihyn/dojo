import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, chainConfig, reputationSummary } from "@dojo/core";
import { ActivatePanel } from "@/components/ActivatePanel";
import { ProbeList } from "@/components/ProbeList";
import { Row, Slip, SlipBody, SlipHead, Stub } from "@/components/Receipt";
import { Scorecard } from "@/components/Scorecard";
import { StatusBadge } from "@/components/StatusBadge";
import { getEntry, gradingMethod } from "@/lib/catalog";
import { ago, chainName, protocolList, shortAddr, shortUri } from "@/lib/format";

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
  const readAt = new Date().toISOString();
  const rep = onchainTokenId === null ? e.reputation : await reputationSummary(e.chainId, onchainTokenId).catch(() => e.reputation);
  const lastProbe = e.probes.map((p) => p.checkedAt).sort().at(-1);
  const tags = rep.byTag ? Object.entries(rep.byTag) : [];
  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-3">
        <Link href="/agents" className="inline-flex min-h-[var(--hit)] items-center hover:text-ink">Agents</Link> / <Link href={`/agents?category=${e.category}`} className="inline-flex min-h-[var(--hit)] items-center hover:text-ink">{CATEGORIES[e.category].label}</Link>
      </nav>

      <header className="max-w-3xl">
        <h1 className="text-3xl text-ink md:text-4xl">{e.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
          <StatusBadge state={e.liveStatus} />
          <span>last probe {ago(lastProbe)}</span>
          <span>{CATEGORIES[e.category].label}</span>
          <span>{protocolList(e.protocols) || "no endpoint"}{e.x402 ? " · x402" : ""}</span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <Slip label="Does it answer">
            <SlipHead eyebrow="Probed by Dojo, not self-reported" title="Does it answer?" />
            <SlipBody><ProbeList initial={e.probes} /></SlipBody>
          </Slip>

          <Slip label="On-chain reputation">
            <SlipHead eyebrow="ERC-8004 ReputationRegistry, read live" title="On-chain reputation" />
            <SlipBody>
              <Row label="Feedback rows" mark={rep.count > 0}>{rep.count}</Row>
              <Row label="Distinct authors">{rep.clients ?? "unknown"}</Row>
              {tags.length > 0 ? tags.map(([t, v]) => (
                <Row key={t} label={<span className="num">{t}</span>}>{v.mean.toFixed(1)} <span className="text-ink-3">×{v.count}</span></Row>
              )) : rep.count === 0 ? (
                <p className="mt-2 text-sm text-ink-2">No feedback has been posted to the ReputationRegistry for this agent.</p>
              ) : <Row label="Mean">{rep.value == null ? "no score" : rep.value.toFixed(2)}</Row>}
              <p className="mt-3 text-xs text-ink-3">Anyone can post feedback, and tags carry different units, so rows are shown per tag rather than blended. Dojo posts graded scores here under the tag <code>dojo-graded</code>.</p>
            </SlipBody>
            <Stub left={`${chainName(e.chainId)} · token #${e.tokenId}`} right={`read ${ago(readAt)}`} />
          </Slip>

          <Slip label="Graded performance">
            <SlipHead eyebrow="Measured outcomes, not self-reported" title="Graded performance" />
            <SlipBody><Scorecard sc={e.performance} method={gradingMethod(e.key)} /></SlipBody>
          </Slip>

          <section aria-label="What the agent says about itself" className="border-t border-line pt-8">
            <div className="caps">The agent says</div>
            <p className="mt-1 text-xs text-ink-3">From its own registration file. Not checked by Dojo except where the evidence above covers it.</p>
            <p className="mt-3 max-w-2xl text-sm text-ink-2">{e.description || "No description in the registration file."}</p>
            <div className="mt-4 max-w-2xl">
              <Row label="Sorted as" sub={e.classification.matched.length > 0 ? `from: ${e.classification.matched.map((m) => m.split(":")[1]).join(", ")}` : undefined}>
                {CATEGORIES[e.category].label}, {(e.classification.confidence * 100).toFixed(0)}%
              </Row>
              <Row label="Owner">{shortAddr(e.owner)}</Row>
              <Row label="Agent wallet">{shortAddr(e.agentWallet)}</Row>
              <Row label="Registration file">{e.registration.ok ? "parses" : "broken"}</Row>
            </div>
            {e.registration.warnings.length > 0 && (
              <ul className="mt-3 max-w-2xl space-y-1 text-xs text-warn">{e.registration.warnings.map((w) => <li key={w}>Problem: {w}</li>)}</ul>
            )}
            {!e.registration.ok && <p className="mt-2 text-xs text-critical">Registration file could not be read: {e.registration.error}</p>}
            <p className="num mt-3 max-w-2xl break-all text-xs text-ink-3">Registration URI: {shortUri(e.registration.onchainUri)}</p>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <ActivatePanel e={e} />
          <div className="rounded-slip border border-line bg-paper px-6 py-5 shadow-slip">
            <div className="caps">Elsewhere</div>
            <ul className="mt-2 space-y-1 text-sm">
              <li><a className="flex min-h-[var(--hit)] items-center text-ink-2 underline underline-offset-4 hover:text-ink" href={`${cfg.explorer}/token/${cfg.identityRegistry}?a=${e.tokenId}`} target="_blank" rel="noreferrer">Identity Registry on the explorer</a></li>
              <li><a className="flex min-h-[var(--hit)] items-center text-ink-2 underline underline-offset-4 hover:text-ink" href={`https://8004scan.io/agents/${e.chainId === 56 ? "bsc" : "bsc-testnet"}/${e.tokenId}`} target="_blank" rel="noreferrer">8004scan</a></li>
            </ul>
            {e.scan && (
              <div className="mt-3">
                <Row label="8004scan score">{e.scan.totalScore ?? "none"}</Row>
                <Row label="Endpoint">{e.scan.endpointVerified ? "verified" : "unverified"}</Row>
                <Row label="Feedbacks">{e.scan.feedbacks}</Row>
              </div>
            )}
            <p className="mt-3 text-xs text-ink-3">Catalog snapshot {ago(e.updatedAt)}.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
