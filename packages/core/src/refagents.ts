/**
 * Reference agents run by Dojo itself, one per core category. Each call returns a result and a
 * receipt: every chain or API read is logged with provenance, the reasoning is spelled out, and the
 * decision is typed so the grader can score it later. No LLM is involved, so cost is gas-free reads.
 */
import { createHash } from "node:crypto";
import type { Address } from "viem";
import { isAddress } from "viem";
import type { Category } from "./classify";
import { REGISTRATION_TYPE } from "./registration";
import { newReceiptId, receiptSchema, type Decision, type Receipt, type ToolCall } from "./receipts";
import { checkRange, planGrid, readV2Price, readV3State } from "./pancake";
import { findRecentBorrowers, readVenusHealth, readVenusStableYields } from "./venus";

export type RefAgentName = "venus-health" | "venus-yield" | "grid-planner" | "range-keeper";

export interface RefAgentDef {
  name: RefAgentName;
  title: string;
  category: Category;
  description: string;
  skill: { id: string; name: string; description: string; examples: string[] };
  sampleInput: Record<string, unknown>;
}

export const REF_AGENTS: Record<RefAgentName, RefAgentDef> = {
  "venus-health": {
    name: "venus-health", title: "Dojo Health Sentinel", category: "health-factor",
    description: "Reads a Venus lending position on BNB Chain market by market, computes its health factor and the collateral drawdown that would liquidate it, and cross-checks the result against the protocol's own getAccountLiquidity. When the two disagree it says so.",
    skill: { id: "venus-health-check", name: "Venus health check", description: "Health factor, liquidation distance and per-market breakdown for one account", examples: ["{\"account\":\"0x...\"}", "{} (picks a recent borrower)"] },
    sampleInput: { account: "" },
  },
  "venus-yield": {
    name: "venus-yield", title: "Dojo Yield Scout", category: "yield",
    description: "Ranks stablecoin supply yields on Venus core pool. Uses the Venus API when it answers and falls back to on-chain supplyRatePerBlock with an explicit blocks-per-year assumption that is written into the receipt.",
    skill: { id: "stable-yield-rank", name: "Stablecoin yield ranking", description: "Best available stablecoin supply APY on Venus with liquidity and price-validity flags", examples: ["{\"amountUsd\":10000}"] },
    sampleInput: { amountUsd: 10000 },
  },
  "grid-planner": {
    name: "grid-planner", title: "Dojo Grid Planner", category: "grid",
    description: "Plans a geometric grid for BNB/USDT on PancakeSwap from the live v2 and v3 prices, sizes each level from a budget, and warns when the spacing is thinner than fees or the price sits outside the grid.",
    skill: { id: "grid-plan", name: "Grid plan", description: "Buy and sell ladder between a lower and upper price with per-level sizing", examples: ["{\"lower\":600,\"upper\":800,\"levels\":9,\"budgetUsd\":1000}"] },
    sampleInput: { lower: 600, upper: 800, levels: 9, budgetUsd: 1000 },
  },
  "range-keeper": {
    name: "range-keeper", title: "Dojo Range Keeper", category: "rebalancing",
    description: "Checks whether a PancakeSwap v3 BNB/USDT position is still in range against the live pool tick, how far it is from the edge, and proposes a recentred range snapped to the pool's tick spacing when it is out or about to be.",
    skill: { id: "range-check", name: "LP range check", description: "In-range status, distance to edge and a recentred range suggestion for a v3 position", examples: ["{\"tickLower\":-66800,\"tickUpper\":-64800}"] },
    sampleInput: { tickLower: -66800, tickUpper: -64800, targetWidthPct: 20 },
  },
};

export interface RunResult { result: Record<string, unknown>; receipt: Receipt; receiptHash: `0x${string}` }

export async function runRefAgent(name: RefAgentName, input: Record<string, unknown>, opts: { agentKey?: string; task?: string } = {}): Promise<RunResult> {
  const def = REF_AGENTS[name];
  if (!def) throw new Error(`unknown reference agent ${name}`);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const calls: ToolCall[] = [];
  const reasoning: string[] = [];
  let decision: Decision;
  let result: Record<string, unknown>;

  if (name === "venus-health") {
    let account = typeof input.account === "string" && input.account ? input.account : "";
    if (!account) {
      const t1 = Date.now();
      const found = await findRecentBorrowers(1);
      calls.push({ tool: "venus.findRecentBorrowers", args: { blocksBack: 40000, rpc: process.env.BSC_LOGS_RPC_URL ?? "bsc-rpc.publicnode.com" }, provenance: found.length ? "live" : "missing", latencyMs: Date.now() - t1, note: found.length ? `picked ${found[0]}` : "no Borrow events in window" });
      if (!found.length) throw new Error("no account given and no recent borrower found");
      account = found[0];
      reasoning.push(`No account supplied; took the most recent borrower seen in the last 40,000 blocks: ${account}.`);
    }
    if (!isAddress(account)) throw new Error("account must be an address");
    const h = await readVenusHealth(account as Address, calls);
    reasoning.push(`Collateral $${h.collateralUsd.toFixed(2)} across ${h.markets.length} market(s); after collateral factors $${h.weightedCollateralUsd.toFixed(2)} backs $${h.borrowUsd.toFixed(2)} of debt.`);
    reasoning.push(h.borrowUsd === 0 ? "Nothing borrowed, so there is no liquidation risk." : `Health factor ${h.healthFactor.toFixed(3)}; collateral can fall ${(h.liquidationDrawdown * 100).toFixed(1)}% before shortfall.`);
    reasoning.push(h.crossCheck.ok ? `Protocol getAccountLiquidity agrees within ${(h.crossCheck.relDiff * 100).toFixed(2)}%.` : `Protocol view differs by ${(h.crossCheck.relDiff * 100).toFixed(2)}%; treat this answer as unverified.`);
    const sev = h.status === "liquidatable" ? "critical" : h.status === "danger" ? "critical" : h.status === "watch" ? "warning" : "info";
    decision = { kind: "alert", severity: sev, subject: account, message: h.status === "no-borrow" ? "no debt, no action" : `${h.status}: health factor ${h.healthFactor.toFixed(3)}${h.status === "healthy" ? "" : ", reduce debt or add collateral"}` };
    result = { ...h, healthFactor: Number.isFinite(h.healthFactor) ? h.healthFactor : null };
  } else if (name === "venus-yield") {
    const amount = typeof input.amountUsd === "number" && input.amountUsd > 0 ? input.amountUsd : 10_000;
    const rows = await readVenusStableYields(calls);
    const usable = rows.filter((r) => !r.priceInvalid && r.supplyApy > 0);
    if (usable.length === 0) throw new Error("no stablecoin market with a positive yield");
    const best = usable[0];
    reasoning.push(`${rows.length} stablecoin markets read from ${best.source === "venus-api" ? "the Venus API" : "chain rates with an assumed blocks/year"}; ${rows.length - usable.length} excluded for zero yield or invalid price.`);
    reasoning.push(`Best supply APY is ${best.market} at ${best.supplyApy.toFixed(2)}%; on $${amount.toLocaleString()} that is $${((best.supplyApy / 100) * amount).toFixed(2)} a year.`);
    if (best.liquidityUsd != null && best.liquidityUsd < amount * 10) reasoning.push(`Liquidity $${best.liquidityUsd.toFixed(0)} is thin relative to the amount; the rate will move on entry.`);
    decision = { kind: "report", summary: `supply ${best.underlying} on Venus (${best.market}) at ${best.supplyApy.toFixed(2)}% APY` };
    result = { amountUsd: amount, best, ranking: rows };
  } else if (name === "grid-planner") {
    const [v2, v3] = await Promise.all([readV2Price(calls), readV3State(calls)]);
    const drift = Math.abs(v2 / v3.priceUsdtPerBnb - 1);
    const current = v3.priceUsdtPerBnb;
    reasoning.push(`Live BNB/USDT: v3 pool $${current.toFixed(2)}, v2 pair $${v2.toFixed(2)} (${(drift * 100).toFixed(2)}% apart).`);
    const lower = num(input.lower, current * 0.85), upper = num(input.upper, current * 1.15), levels = Math.round(num(input.levels, 9)), budgetUsd = num(input.budgetUsd, 1000);
    const plan = planGrid({ currentPrice: current, lower, upper, levels, budgetUsd });
    reasoning.push(`${levels} levels between $${lower.toFixed(2)} and $${upper.toFixed(2)} gives ${plan.spacingPct.toFixed(2)}% spacing and $${plan.perLevelUsd} per level.`);
    for (const w of plan.warnings) reasoning.push(`Warning: ${w}`);
    decision = { kind: "report", summary: `${plan.orders.filter((o) => o.side === "buy").length} buys / ${plan.orders.filter((o) => o.side === "sell").length} sells, ${plan.spacingPct.toFixed(2)}% apart` };
    result = { prices: { v3: current, v2, driftPct: drift * 100 }, plan };
  } else {
    const v3 = await readV3State(calls);
    const tickLower = Math.round(num(input.tickLower, v3.tick - 1000)), tickUpper = Math.round(num(input.tickUpper, v3.tick + 1000));
    const check = checkRange({ currentTick: v3.tick, tickLower, tickUpper, tickSpacing: 10, targetWidthPct: typeof input.targetWidthPct === "number" ? input.targetWidthPct : undefined });
    reasoning.push(`Pool tick ${v3.tick} ($${v3.priceUsdtPerBnb.toFixed(2)} per BNB); position [${tickLower}, ${tickUpper}) is ${check.inRange ? "in range" : "out of range"}, ${Math.abs(check.distanceToEdgePct).toFixed(2)}% ${check.inRange ? "from the nearest edge" : "outside"}.`);
    if (check.suggestion) reasoning.push(`Suggested range [${check.suggestion.tickLower}, ${check.suggestion.tickUpper}) recentres on the current tick at ${check.widthPct.toFixed(1)}% width, snapped to spacing 10.`);
    decision = check.action === "hold" ? { kind: "report", summary: "in range, hold" } : { kind: "alert", severity: check.action === "rebalance-now" ? "critical" : "warning", subject: `${tickLower}:${tickUpper}`, message: check.action === "rebalance-now" ? "position is out of range and earning no fees; rebalance" : "price is within 1% of the range edge; prepare to rebalance" };
    result = { pool: { tick: v3.tick, priceUsdtPerBnb: v3.priceUsdtPerBnb, liquidity: v3.liquidity.toString() }, check };
  }

  const completedAt = new Date().toISOString();
  const receipt: Receipt = receiptSchema.parse({
    id: newReceiptId(opts.agentKey ?? `seed:${name}`, startedAt), agentKey: opts.agentKey ?? `seed:${name}`, agentName: def.title, category: def.category,
    task: opts.task ?? `${def.skill.id} ${JSON.stringify(input).slice(0, 120)}`, startedAt, completedAt, inputs: calls, reasoning, decision, cost: { usd: 0, wallMs: Date.now() - t0 },
  });
  return { result: JSON.parse(JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v))), receipt, receiptHash: hashReceipt(receipt) };
}

export function hashReceipt(r: Receipt): `0x${string}` {
  return `0x${createHash("sha256").update(JSON.stringify(r)).digest("hex")}`;
}

/**
 * The ERC-8004 registration file for a reference agent. This is what `register(agentURI)` points at
 * on the Identity Registry, and it is deliberately the same shape Dojo demands of everyone else:
 * a declared type, a description, and services named so that `serviceEndpoints` resolves them.
 */
export function registrationFile(def: RefAgentDef, baseUrl: string): Record<string, unknown> {
  return {
    type: REGISTRATION_TYPE,
    name: def.title,
    description: def.description,
    services: [
      { name: "A2A", endpoint: `${baseUrl}/ref/${def.name}/.well-known/agent-card.json`, version: "0.3.0", skills: [def.skill] },
      { name: "Web", endpoint: `${baseUrl}/try/${def.name}` },
    ],
    x402Support: false,
    active: true,
    supportedTrust: ["reputation"],
    "x-dojo": { category: def.category, receipts: true, operator: "Dojo" },
  };
}

export function agentCard(def: RefAgentDef, baseUrl: string): Record<string, unknown> {
  return {
    name: def.title, description: def.description, url: `${baseUrl}/api/ref/${def.name}`, version: "0.1.0", protocolVersion: "0.3.0",
    provider: { organization: "Dojo", url: baseUrl }, capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"],
    skills: [{ id: def.skill.id, name: def.skill.name, description: def.skill.description, tags: [def.category, "bnb", "venus", "pancakeswap"].slice(0, 3), examples: def.skill.examples }],
    "x-dojo": { category: def.category, receipts: true, sampleInput: def.sampleInput },
  };
}

function num(v: unknown, d: number): number { return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d; }
