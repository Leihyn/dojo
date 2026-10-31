import type { Catalog, CatalogEntry, Category, RefAgentName, Scorecard } from "@dojo/core";
import { CATEGORIES, REF_AGENTS, rank } from "@dojo/core";
import raw from "@/data/catalog.json";

const catalog = raw as unknown as Catalog;

export function getCatalog(): Catalog {
  return catalog;
}

export function getEntry(key: string): CatalogEntry | undefined {
  return catalog.entries.find((e) => e.key === key);
}

export interface Filters {
  category?: string;
  live?: boolean;
  chainId?: number;
  q?: string;
  protocol?: string;
}

export function filterEntries(f: Filters): CatalogEntry[] {
  const q = f.q?.trim().toLowerCase();
  // Sort here rather than trusting the order in the snapshot: scores are merged into the catalog
  // after indexing, so file order does not reflect grading.
  return catalog.entries.filter((e) => {
    if (f.category && e.category !== f.category) return false;
    if (f.live && e.liveStatus !== "live" && e.liveStatus !== "gated") return false;
    if (f.chainId && e.chainId !== f.chainId) return false;
    if (f.protocol && !e.protocols.map((p) => p.toLowerCase()).includes(f.protocol.toLowerCase())) return false;
    if (q && !`${e.name} ${e.description} ${e.tokenId}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort(rank);
}

export interface CategoryCount { category: Category; label: string; blurb: string; core: boolean; total: number; live: number; graded: number }

export function categoryCounts(): CategoryCount[] {
  const out: CategoryCount[] = [];
  for (const [cat, meta] of Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][]) {
    const items = catalog.entries.filter((e) => e.category === cat);
    out.push({ category: cat, label: meta.label, blurb: meta.blurb, core: meta.core, total: items.length, live: items.filter((e) => e.liveStatus === "live" || e.liveStatus === "gated").length, graded: items.filter((e) => e.performance?.score != null).length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Replay grading metadata. Written by `pnpm replay`; absent until it has run.
import scorecardsJson from "@/data/scorecards.json";

export interface GradingMethod { metric: string; source: string; window: string }
interface ScorecardsFile { builtAt?: string; symbol?: string; interval?: string; bars?: number; spanDays?: number; horizonMin?: number; methods?: Record<string, GradingMethod> }

const scorecards = scorecardsJson as ScorecardsFile;

/** How a given agent's score was produced, so the UI can never show a number without its method. */
export function gradingMethod(key: string): GradingMethod | undefined {
  return scorecards.methods?.[key];
}

export function gradingRun(): ScorecardsFile {
  return scorecards;
}

export interface GradedAgent { key: string; name: string; title: string; sc: Scorecard; method?: GradingMethod }

/** Agents with a real score, best first. Today these are the reference agents graded by replay. */
export function gradedAgents(): GradedAgent[] {
  const all = (scorecardsJson as { scorecards?: Record<string, Scorecard> }).scorecards ?? {};
  return Object.entries(all)
    .filter(([, sc]) => sc.score != null)
    .map(([key, sc]) => {
      const name = key.replace(/^\d+:dojo-/, "");
      return { key, name, title: REF_AGENTS[name as RefAgentName]?.title ?? name, sc, method: scorecards.methods?.[key] };
    })
    .sort((a, b) => (b.sc.score ?? 0) - (a.sc.score ?? 0));
}
