/**
 * Catalog builder. Candidates come from 8004scan (coverage); every fact a hirer sees is then
 * re-derived from the chain and from live probes (verification). The output is a JSON snapshot the
 * web app serves, plus a data-quality report.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { agentKey } from "./chains";
import { classify, classifierText, type Category, type Classification } from "./classify";
import { probeAll, summarize, type Probe, type ProbeState } from "./liveness";
import { resolveRegistration, serviceEndpoints, type Registration } from "./registration";
import { readAgent, reputationSummary, type ReputationSummary } from "./registry";
import { ScanClient, type ScanAgent } from "./scan";
import type { Scorecard } from "./grader";

export interface CatalogEntry {
  key: string;
  chainId: number;
  tokenId: string;
  name: string;
  description: string;
  image: string | null;
  category: Category;
  classification: Classification;
  protocols: string[];
  endpoints: { a2a?: string; mcp?: string; web?: string; other: Record<string, string> };
  x402: boolean;
  owner: string | null;
  agentWallet: string | null;
  registration: { ok: boolean; source: string; warnings: string[]; error?: string; onchainUri: string | null };
  probes: Probe[];
  liveStatus: ProbeState;
  reputation: ReputationSummary;
  scan: { totalScore: number | null; healthStatus: string | null; endpointVerified: boolean; feedbacks: number } | null;
  performance: Scorecard | null;
  source: "8004scan" | "seed";
  seedMeta?: Record<string, unknown>;
  updatedAt: string;
}

export interface Catalog {
  builtAt: string;
  chainIds: number[];
  entries: CatalogEntry[];
  quality: QualityReport;
}

export interface QualityReport {
  candidates: number;
  registrationOk: number;
  registrationFailed: number;
  withEndpoint: number;
  live: number;
  gated: number;
  dead: number;
  unresolved: number;
  byCategory: Record<string, number>;
  warnings: Record<string, number>;
  scanTotals: Record<string, number>;
  /** Filters that did not answer. Coverage is narrower than intended when this is non-empty, and the marketplace says so rather than quietly showing fewer agents. */
  scanFailures: string[];
}

export interface BuildOptions {
  chainIds: number[];
  perFilter: number;
  scan: ScanClient;
  concurrency?: number;
  seedFile?: string;
  log?: (s: string) => void;
}

export async function buildCatalog(opts: BuildOptions): Promise<Catalog> {
  const log = opts.log ?? (() => {});
  const candidates = new Map<string, ScanAgent>();
  const scanTotals: Record<string, number> = {};
  const scanFailures: string[] = [];
  for (const chainId of opts.chainIds) {
    const filters: Array<[string, Parameters<ScanClient["listAgents"]>[0]]> = [
      ["endpoint_verified", { chainId, endpointVerified: true, limit: opts.perFilter }],
      ["has_mcp", { chainId, hasMcp: true, limit: opts.perFilter }],
      ["has_a2a", { chainId, hasA2a: true, limit: opts.perFilter }],
      ["x402", { chainId, x402: true, limit: opts.perFilter }],
      ["latest", { chainId, limit: opts.perFilter }],
    ];
    for (const [name, p] of filters) {
      // One filter failing costs coverage; it must not cost the whole run. The failure is recorded
      // and reported, because silently indexing fewer agents is worse than saying which lens went dark.
      try {
        const { items, total } = await opts.scan.listAgents(p);
        scanTotals[`${chainId}:${name}`] = total;
        for (const a of items) candidates.set(agentKey(a.chain_id, a.token_id), a);
        log(`[scan] chain ${chainId} ${name}: ${items.length} of ${total}`);
      } catch (e) {
        scanFailures.push(`${chainId}:${name}: ${(e as Error).message}`);
        log(`[scan] chain ${chainId} ${name}: FAILED (${(e as Error).message}) - continuing with reduced coverage`);
      }
    }
  }

  const entries: CatalogEntry[] = [];
  const list = [...candidates.values()];
  await mapLimit(list, opts.concurrency ?? 6, async (a) => {
    const e = await enrich(a);
    entries.push(e);
    log(`[enrich] ${e.key} ${e.name.slice(0, 30)} -> ${e.category} / ${e.liveStatus}`);
  });

  if (opts.seedFile) {
    for (const s of await readSeed(opts.seedFile)) entries.push(s);
  }

  entries.sort(rank);
  return { builtAt: new Date().toISOString(), chainIds: opts.chainIds, entries, quality: qualityReport(entries, scanTotals, scanFailures) };
}

async function enrich(a: ScanAgent): Promise<CatalogEntry> {
  const tokenId = BigInt(a.token_id);
  const onchain = await readAgent(a.chain_id, tokenId);
  const resolved = await resolveRegistration(onchain.uri);
  const reg: Registration | null = resolved.registration;
  const endpoints = serviceEndpoints(reg);
  // Fall back to the indexer's view of endpoints when the registration file did not resolve.
  if (!endpoints.a2a && a.a2a_endpoint) endpoints.a2a = a.a2a_endpoint;
  if (!endpoints.mcp && a.mcp_server) endpoints.mcp = a.mcp_server;
  if (!endpoints.web && a.agent_url) endpoints.web = a.agent_url;
  const probes = await probeAll(endpoints);
  const card = probes.find((p) => p.kind === "a2a")?.card;
  const text = classifierText([reg?.name, reg?.description, a.name, a.description, a.tags, a.categories, card?.name, card?.description, card?.skills, (reg?.services ?? []).flatMap((s) => (Array.isArray(s.skills) ? s.skills.map((k) => JSON.stringify(k).slice(0, 200)) : []))]);
  const classification = classify(text);
  const reputation = await reputationSummary(a.chain_id, tokenId);
  return {
    key: agentKey(a.chain_id, a.token_id),
    chainId: a.chain_id,
    tokenId: a.token_id,
    name: displayName(reg?.name ?? a.name, card?.name) ?? `Agent #${a.token_id}`,
    description: reg?.description || a.description || card?.description || "",
    image: reg?.image ?? a.image_url ?? null,
    category: classification.category,
    classification,
    protocols: [...new Set([...(a.supported_protocols ?? []), ...Object.keys(endpoints).filter((k) => k !== "other" && (endpoints as Record<string, unknown>)[k]).map((k) => k.toUpperCase())])],
    endpoints,
    x402: Boolean(reg?.x402Support ?? a.x402_supported),
    owner: onchain.owner,
    agentWallet: onchain.agentWallet,
    registration: { ok: resolved.ok, source: resolved.source, warnings: [...resolved.warnings, ...onchain.errors], error: resolved.error, onchainUri: onchain.uri ? onchain.uri.slice(0, 120) : null },
    probes,
    liveStatus: summarize(probes),
    reputation,
    scan: { totalScore: a.total_score, healthStatus: a.health_status ?? null, endpointVerified: Boolean(a.is_endpoint_verified), feedbacks: a.total_feedbacks ?? 0 },
    performance: null,
    source: "8004scan",
    updatedAt: new Date().toISOString(),
  };
}

/** Seed entries: reference agents we run ourselves plus partner skills, declared in a JSON file. */
async function readSeed(file: string): Promise<CatalogEntry[]> {
  let raw: string;
  try { raw = await readFile(file, "utf8"); } catch { return []; }
  raw = raw.replace(/\$\{BASE_URL\}/g, (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""));
  const items = JSON.parse(raw) as Array<Partial<CatalogEntry> & { name: string; description: string; category: Category; chainId: number; tokenId: string }>;
  const out: CatalogEntry[] = [];
  for (const s of items) {
    const endpoints = s.endpoints ?? { other: {} };
    const probes = await probeAll(endpoints);
    out.push({
      key: agentKey(s.chainId, s.tokenId), chainId: s.chainId, tokenId: s.tokenId, name: s.name, description: s.description, image: s.image ?? null,
      category: s.category, classification: classify(classifierText([s.name, s.description])), protocols: s.protocols ?? Object.keys(endpoints).filter((k) => k !== "other").map((k) => k.toUpperCase()),
      endpoints, x402: s.x402 ?? false, owner: s.owner ?? null, agentWallet: s.agentWallet ?? null,
      registration: s.registration ?? { ok: true, source: "seed", warnings: [], onchainUri: null }, probes, liveStatus: summarize(probes),
      reputation: s.reputation ?? { count: 0, value: null, rawValue: null, decimals: 0, clients: 0, byTag: {} }, scan: null, performance: s.performance ?? null, source: "seed", seedMeta: s.seedMeta, updatedAt: new Date().toISOString(),
    });
  }
  return out;
}

const GENERIC_NAMES = /^(studio-?agent|agent|test|my-?agent|untitled|new agent|default|demo)$/i;

/** Registry names are often scaffold placeholders; the live agent card is the better witness. */
export function displayName(registryName: string | null | undefined, cardName: string | null | undefined): string | undefined {
  const r = registryName?.trim();
  const c = cardName?.trim();
  if (c && (!r || GENERIC_NAMES.test(r))) return c;
  return r || c || undefined;
}

const LIVE_RANK: Record<ProbeState, number> = { live: 0, gated: 1, unresolved: 2, skipped: 3, dead: 4 };
/**
 * Ranking order: a graded score first, then whether the agent answers, then how much on-chain
 * feedback it carries. Exported because the marketplace must sort with it at read time. Relying on
 * the order the catalog file happens to be written in silently drops graded agents down the page
 * whenever scores are merged in after indexing.
 */
export function rank(a: CatalogEntry, b: CatalogEntry): number {
  const pa = a.performance?.score ?? -1, pb = b.performance?.score ?? -1;
  if (pa !== pb) return pb - pa;
  if (LIVE_RANK[a.liveStatus] !== LIVE_RANK[b.liveStatus]) return LIVE_RANK[a.liveStatus] - LIVE_RANK[b.liveStatus];
  if (a.reputation.count !== b.reputation.count) return b.reputation.count - a.reputation.count;
  return (b.scan?.totalScore ?? 0) - (a.scan?.totalScore ?? 0);
}

function qualityReport(entries: CatalogEntry[], scanTotals: Record<string, number>, scanFailures: string[] = []): QualityReport {
  const q: QualityReport = { candidates: entries.length, registrationOk: 0, registrationFailed: 0, withEndpoint: 0, live: 0, gated: 0, dead: 0, unresolved: 0, byCategory: {}, warnings: {}, scanTotals, scanFailures };
  for (const e of entries) {
    if (e.registration.ok) q.registrationOk++; else q.registrationFailed++;
    if (e.endpoints.a2a || e.endpoints.mcp || e.endpoints.web) q.withEndpoint++;
    if (e.liveStatus === "live") q.live++; else if (e.liveStatus === "gated") q.gated++; else if (e.liveStatus === "dead") q.dead++; else q.unresolved++;
    q.byCategory[e.category] = (q.byCategory[e.category] ?? 0) + 1;
    for (const w of e.registration.warnings) { const k = w.replace(/\{[a-zA-Z_]+\}|: .*$/g, "").slice(0, 60); q.warnings[k] = (q.warnings[k] ?? 0) + 1; }
  }
  return q;
}

export async function writeCatalog(catalog: Catalog, outFile: string): Promise<void> {
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(catalog, null, 1));
  await writeFile(outFile.replace(/\.json$/, "-quality.md"), qualityMarkdown(catalog));
}

export function qualityMarkdown(c: Catalog): string {
  const q = c.quality;
  const lines = [`# Catalog data quality`, ``, `Built ${c.builtAt} for chains ${c.chainIds.join(", ")}.`, ``,
    `| Measure | Count |`, `|---|---|`, `| Candidates enriched | ${q.candidates} |`, `| Registration file resolves and parses | ${q.registrationOk} |`, `| Registration file missing or broken | ${q.registrationFailed} |`,
    `| Advertises an endpoint | ${q.withEndpoint} |`, `| Endpoint answered (live) | ${q.live} |`, `| Endpoint answered with auth/payment gate | ${q.gated} |`, `| Endpoint dead | ${q.dead} |`, `| Endpoint unresolved (template or non-http) | ${q.unresolved} |`, ``,
    `## Registry totals reported by 8004scan`, ``, ...Object.entries(q.scanTotals).map(([k, v]) => `- ${k}: ${v}`), ``,
    `## Category split`, ``, ...Object.entries(q.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`), ``,
    `## Most common registration warnings`, ``, ...Object.entries(q.warnings).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `- ${k}: ${v}`), ``];
  return lines.join("\n");
}

async function mapLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; try { await fn(item); } catch (e) { console.warn(`[catalog] ${e instanceof Error ? e.message : e}`); } }
  });
  await Promise.all(workers);
}
