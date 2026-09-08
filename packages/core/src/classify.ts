/**
 * Category classifier. Rule-based by design: it runs offline, is testable, and its evidence
 * (which terms matched) is shown to the hirer. An LLM can refine, never replace, the ruling.
 */
export type Category = "rebalancing" | "grid" | "yield" | "health-factor" | "monitoring" | "trading" | "research" | "other";

export const CATEGORIES: Record<Category, { label: string; blurb: string; core: boolean }> = {
  rebalancing: { label: "Rebalancing", blurb: "Manages LP ranges and resets positions automatically", core: true },
  grid: { label: "Grid Trading", blurb: "Places and manages automated grid orders", core: true },
  yield: { label: "Yield Optimisation", blurb: "Routes liquidity to the highest available APR", core: true },
  "health-factor": { label: "Health Factor Monitoring", blurb: "Protects lending positions from liquidation", core: true },
  monitoring: { label: "Monitoring", blurb: "Watches markets, wallets and positions and raises alerts", core: false },
  trading: { label: "Trading", blurb: "Executes or advises on token trades", core: false },
  research: { label: "Research", blurb: "Token, contract and market analysis", core: false },
  other: { label: "Other", blurb: "Not yet categorised", core: false },
};

interface Rule { category: Category; weight: number; re: RegExp }

const RULES: Rule[] = [
  { category: "rebalancing", weight: 3, re: /\brebalanc\w*\b/i },
  { category: "rebalancing", weight: 3, re: /\b(lp|liquidity)\s+(range|position)s?\b/i },
  { category: "rebalancing", weight: 2, re: /\b(concentrated liquidity|out[- ]of[- ]range|tick range|v3 position|v4 position|reset(s|ting)? position)/i },
  { category: "grid", weight: 4, re: /\bgrid\s*(trading|bot|order|strategy)?\b/i },
  { category: "grid", weight: 2, re: /\b(price ladder|laddered orders|buy low sell high within)/i },
  { category: "yield", weight: 3, re: /\byield\w*\b/i },
  { category: "yield", weight: 3, re: /\b(apr|apy)\b/i },
  { category: "yield", weight: 2, re: /\b(vault|staking|restak\w*|farm\w*|highest[- ]earning|liquid staking|auto[- ]compound\w*)\b/i },
  { category: "health-factor", weight: 5, re: /\bhealth\s*factor\b/i },
  { category: "health-factor", weight: 4, re: /\bliquidat\w*\b/i },
  { category: "health-factor", weight: 2, re: /\b(collateral|borrow\w*|lending position|loan position|ltv|venus|aave|repay\w*)\b/i },
  { category: "monitoring", weight: 3, re: /\b(monitor\w*|watch\w*|alert\w*|track\w*|notif\w*)\b/i },
  { category: "monitoring", weight: 1, re: /\b(wallet tracker|whale|on[- ]chain activity|price feed)\b/i },
  { category: "trading", weight: 3, re: /\b(trading|trader|swap\w*|buy|sell|dex|perp\w*|copy[- ]trad\w*|sniper?|memecoin|meme coin)\b/i },
  { category: "research", weight: 3, re: /\b(research|analy\w*|audit\w*|security check|rug|scan\w*|token info|due diligence|report)\b/i },
];

export interface Classification {
  category: Category;
  confidence: number;
  scores: Partial<Record<Category, number>>;
  matched: string[];
}

export function classify(text: string): Classification {
  const scores: Partial<Record<Category, number>> = {};
  const matched: string[] = [];
  for (const r of RULES) {
    const m = text.match(r.re);
    if (m) {
      scores[r.category] = (scores[r.category] ?? 0) + r.weight;
      matched.push(`${r.category}:${m[0].toLowerCase().slice(0, 30)}`);
    }
  }
  const entries = Object.entries(scores) as [Category, number][];
  if (entries.length === 0) return { category: "other", confidence: 0, scores, matched };
  entries.sort((a, b) => b[1] - a[1]);
  const [top, topScore] = entries[0];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  // Core categories win ties against generic ones (a "liquidation alert" agent is health-factor, not monitoring).
  const runnerUp = entries[1];
  let category = top;
  if (runnerUp && runnerUp[1] === topScore && CATEGORIES[runnerUp[0]].core && !CATEGORIES[top].core) category = runnerUp[0];
  return { category, confidence: Math.round((topScore / total) * 100) / 100, scores, matched };
}

/** Build the text a classifier sees from whatever fields a registration or listing exposes. */
export function classifierText(parts: Array<string | null | undefined | string[]>): string {
  return parts.flatMap((p) => (Array.isArray(p) ? p : [p])).filter((s): s is string => typeof s === "string" && s.length > 0).join(" \n ").slice(0, 4000);
}
