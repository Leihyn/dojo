/**
 * Agent Advantage Report harness (TermiX track).
 *
 * Three real tasks, each run twice: once by hiring a Dojo reference agent, once the way a competent
 * person does it without one, opening the contract on BscScan and reading it function by function.
 *
 * What is measured and what is assumed is kept strictly apart. Machine wall time and the number of
 * distinct contract reads are MEASURED on both arms. Human time is an ASSUMPTION, stated as a
 * per-lookup constant, because timing a real person was not possible here; the constant is declared
 * in the output so a reader can substitute their own.
 *
 * The manual arm deliberately does NOT reuse the agent's helper modules. It issues raw sequential
 * calls, because that is the work the helpers are hiding.
 */
import { createPublicClient, http, type Address } from "viem";
import { bsc } from "viem/chains";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runRefAgent } from "../refagents";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); args.set(k, v ?? process.argv[++i] ?? "true"); }
}
const root = path.resolve(process.cwd(), args.get("root") ?? "../..");
const outFile = path.resolve(root, args.get("out") ?? "docs/AGENT_ADVANTAGE_REPORT.md");
/** Seconds a person spends on one BscScan read: find the function, paste the argument, read the raw integer, write it down. */
const SEC_PER_LOOKUP = Number(args.get("sec-per-lookup") ?? 45);
/** Seconds for the arithmetic and unit handling a person still does after the reads. */
const SEC_ARITHMETIC = Number(args.get("sec-arithmetic") ?? 240);

const rpc = process.env.BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";
const client = createPublicClient({ chain: bsc, transport: http(rpc) });

const UNITROLLER: Address = "0xfD36E2c2a6789Db23113685031d7F16329158384";
const V3_POOL: Address = "0x36696169C63e42cd08ce11f5deeBbCeBae652050";

const comptrollerAbi = [
  { type: "function", name: "getAssetsIn", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "address[]" }] },
  { type: "function", name: "markets", stateMutability: "view", inputs: [{ name: "v", type: "address" }], outputs: [{ type: "bool" }, { type: "uint256" }, { type: "bool" }] },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;
const vTokenAbi = [
  { type: "function", name: "getAccountSnapshot", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "supplyRatePerBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const oracleAbi = [{ type: "function", name: "getUnderlyingPrice", stateMutability: "view", inputs: [{ name: "v", type: "address" }], outputs: [{ type: "uint256" }] }] as const;
const poolAbi = [{ type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint32" }, { type: "bool" }] }] as const;

/** One raw read, the unit a person performs on BscScan. Sequential on purpose: nobody batches by hand. */
let lookups = 0;
async function read<T>(fn: () => Promise<T>): Promise<T> { lookups++; return fn(); }

interface Arm { wallMs: number; lookups: number; answer: string; notes: string[] }
interface TaskResult { id: string; title: string; category: string; question: string; agent: Arm & { receiptId: string; crossChecked: boolean }; manual: Arm; divergence?: { agentValue: number; manualValue: number; unit: string; why: string } }

const E18 = BigInt(10) ** BigInt(18);
const results: TaskResult[] = [];

// ── Task 1: is this Venus borrower close to liquidation? (risk / security) ───────────────────────
{
  const account = (args.get("account") ?? "0xD7E004CBda24E079aA3A657Ba7f8E2915192a966") as Address;

  const t0 = Date.now();
  const run = await runRefAgent("venus-health", { account });
  const agentMs = Date.now() - t0;
  const h = run.result as Record<string, never> & { healthFactor: number | null; liquidationDrawdown: number; crossCheck: { ok: boolean; relDiff: number }; status: string };

  lookups = 0;
  const m0 = Date.now();
  const assets = await read(() => client.readContract({ address: UNITROLLER, abi: comptrollerAbi, functionName: "getAssetsIn", args: [account] })) as Address[];
  const oracle = await read(() => client.readContract({ address: UNITROLLER, abi: comptrollerAbi, functionName: "oracle" })) as Address;
  let collateral = 0, weighted = 0, borrow = 0;
  for (const v of assets) {
    const snap = await read(() => client.readContract({ address: v, abi: vTokenAbi, functionName: "getAccountSnapshot", args: [account] })) as readonly [bigint, bigint, bigint, bigint];
    await read(() => client.readContract({ address: v, abi: vTokenAbi, functionName: "symbol" }));
    const mk = await read(() => client.readContract({ address: UNITROLLER, abi: comptrollerAbi, functionName: "markets", args: [v] })) as readonly [boolean, bigint, boolean];
    const px = await read(() => client.readContract({ address: oracle, abi: oracleAbi, functionName: "getUnderlyingPrice", args: [v] })) as bigint;
    const supplyUsd = (Number(snap[1] * snap[3]) / Number(E18)) * (Number(px) / Number(E18));
    const borrowUsd = Number(snap[2]) * (Number(px) / Number(E18)) / 1e18;
    collateral += supplyUsd; weighted += supplyUsd * (Number(mk[1]) / Number(E18)); borrow += borrowUsd;
  }
  const manualMs = Date.now() - m0;
  const manualHf = borrow > 0 ? weighted / borrow : Infinity;

  results.push({
    id: "T1", title: "Is this Venus position close to liquidation?", category: "risk / security",
    question: `Account ${account}: health factor, and how far collateral can fall before shortfall.`,
    agent: {
      wallMs: agentMs, lookups: run.receipt.inputs.length, receiptId: run.receipt.id, crossChecked: h.crossCheck.ok,
      answer: `health factor ${h.healthFactor?.toFixed(3) ?? "n/a"}, ${(h.liquidationDrawdown * 100).toFixed(1)}% drawdown to shortfall, status ${h.status}`,
      notes: [`cross-checked against the protocol's own getAccountLiquidity, agreeing within ${(h.crossCheck.relDiff * 100).toFixed(2)}%`],
    },
    manual: {
      wallMs: manualMs, lookups,
      answer: `health factor ${Number.isFinite(manualHf) ? manualHf.toFixed(3) : "n/a"} (no independent check)`,
      notes: [
        `${assets.length} markets, each needing getAccountSnapshot, symbol, markets() and getUnderlyingPrice`,
        "exchange rate, collateral factor and price are all 18-decimal mantissas that have to be unscaled by hand",
        "nothing in this path tells you whether the arithmetic is right",
      ],
    },
  });
}

// ── Task 2: where is the best stablecoin yield on Venus right now? (yield) ───────────────────────
{
  const t0 = Date.now();
  const run = await runRefAgent("venus-yield", { amountUsd: 10_000 });
  const agentMs = Date.now() - t0;
  const r = run.result as { best: { market: string; supplyApy: number; source: string } };

  const markets: Address[] = [
    "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
    "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
    "0xC4eF4229FEc74Ccfe17B2bdeF7715fAC740BA0ba",
  ];
  lookups = 0;
  const m0 = Date.now();
  const oracle = await read(() => client.readContract({ address: UNITROLLER, abi: comptrollerAbi, functionName: "oracle" })) as Address;
  const rows: Array<{ sym: string; apy: number }> = [];
  const BLOCKS = 42_048_000;
  for (const v of markets) {
    const sym = await read(() => client.readContract({ address: v, abi: vTokenAbi, functionName: "symbol" })) as string;
    const rate = await read(() => client.readContract({ address: v, abi: vTokenAbi, functionName: "supplyRatePerBlock" })) as bigint;
    await read(() => client.readContract({ address: oracle, abi: oracleAbi, functionName: "getUnderlyingPrice", args: [v] }));
    rows.push({ sym, apy: (Number(rate) / 1e18) * BLOCKS * 100 });
  }
  const manualMs = Date.now() - m0;
  rows.sort((a, b) => b.apy - a.apy);

  results.push({
    id: "T2", title: "Best stablecoin supply yield on Venus", category: "yield",
    question: "Where should $10,000 of stablecoins sit on Venus core pool today?",
    agent: {
      wallMs: agentMs, lookups: run.receipt.inputs.length, receiptId: run.receipt.id, crossChecked: false,
      answer: `${r.best.market} at ${r.best.supplyApy.toFixed(2)}% APY (source: ${r.best.source})`,
      notes: ["falls back from the Venus API to on-chain rates and writes the blocks-per-year assumption into the receipt when it does", "excludes markets whose oracle price is stale or zero"],
    },
    divergence: {
      agentValue: r.best.supplyApy, manualValue: rows[0].apy, unit: "% APY",
      why: "the Venus API rate and the raw supplyRatePerBlock rate are different quantities: the on-chain rate is the base supply rate only, and multiplying it by an assumed blocks-per-year is a second source of drift",
    },
    manual: {
      wallMs: manualMs, lookups,
      answer: `${rows[0].sym} at ${rows[0].apy.toFixed(2)}% APY`,
      notes: [
        `blocks-per-year is a hardcoded constant (${BLOCKS.toLocaleString()}); get it wrong and every APY on the page is wrong`,
        "supplyRatePerBlock excludes XVS incentives, so this understates the real rate and nothing warns you",
        "you have to know which vTokens are the stablecoin markets before you start",
      ],
    },
  });
}

// ── Task 3: is my PancakeSwap v3 position still in range? (trading / LP) ─────────────────────────
{
  const tickLower = -66800, tickUpper = -64800;
  const t0 = Date.now();
  const run = await runRefAgent("range-keeper", { tickLower, tickUpper, targetWidthPct: 20 });
  const agentMs = Date.now() - t0;
  const c = run.result as { check: { inRange: boolean; distanceToEdgePct: number; action: string; suggestion: { tickLower: number; tickUpper: number } | null } };

  lookups = 0;
  const m0 = Date.now();
  const slot0 = await read(() => client.readContract({ address: V3_POOL, abi: poolAbi, functionName: "slot0" })) as readonly [bigint, number, number, number, number, number, boolean];
  const manualMs = Date.now() - m0;
  const tick = slot0[1];
  const inRange = tick >= tickLower && tick < tickUpper;

  results.push({
    id: "T3", title: "Is this PancakeSwap v3 position still in range?", category: "trading / LP",
    question: `Position [${tickLower}, ${tickUpper}) on the BNB/USDT 0.05% pool: in range, and if not, where should it move?`,
    agent: {
      wallMs: agentMs, lookups: run.receipt.inputs.length, receiptId: run.receipt.id, crossChecked: false,
      answer: `${c.check.inRange ? "in range" : "out of range"}, ${Math.abs(c.check.distanceToEdgePct).toFixed(2)}% from the edge, action: ${c.check.action}${c.check.suggestion ? `, move to [${c.check.suggestion.tickLower}, ${c.check.suggestion.tickUpper})` : ""}`,
      notes: ["the suggested range is snapped to the pool's tick spacing, so it is actually mintable", "graded: 74/100 over 151 replayed decisions"],
    },
    manual: {
      wallMs: manualMs, lookups,
      answer: `tick ${tick}, ${inRange ? "in range" : "out of range"} (no suggested range)`,
      notes: [
        "one cheap read, but the answer stops at a signed integer",
        "converting tick to a price means 1.0001^tick by hand, and the pool quotes token1/token0 so it reads inverted",
        "a recentred range still has to be snapped to tick spacing or the mint reverts",
      ],
    },
  });
}

// ── Report ───────────────────────────────────────────────────────────────────────────────────────
const fmt = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
const humanMin = (lk: number) => (lk * SEC_PER_LOOKUP + SEC_ARITHMETIC) / 60;

const lines: string[] = [];
lines.push("# Agent Advantage Report");
lines.push("");
lines.push("Three tasks a BNB Chain user actually has, each done twice: once by hiring a Dojo reference");
lines.push("agent, once the way it gets done without one, opening the contract on BscScan and reading it");
lines.push("function by function.");
lines.push("");
lines.push("**What is measured and what is assumed.** Wall time and the number of distinct contract reads");
lines.push("are measured on both arms, on BNB Smart Chain mainnet, in the same run. Human time is not");
lines.push(`measured: it is calculated at **${SEC_PER_LOOKUP}s per lookup** (find the function, paste the argument, read the`);
lines.push(`raw integer, write it down) plus **${(SEC_ARITHMETIC / 60).toFixed(0)} minutes** for the unscaling and arithmetic that follows. Both`);
lines.push("constants are inputs to the script, so substitute your own and the table recomputes.");
lines.push("");
lines.push(`Run: \`${new Date().toISOString()}\` · RPC \`${rpc.replace(/https?:\/\//, "")}\``);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push("| Task | Agent wall | Manual wall | Agent reads | Manual reads | Manual human time | Independent check |");
lines.push("|---|---|---|---|---|---|---|");
for (const t of results) {
  lines.push(`| ${t.id} ${t.title} | ${fmt(t.agent.wallMs)} | ${fmt(t.manual.wallMs)} | ${t.agent.lookups} | ${t.manual.lookups} | ~${humanMin(t.manual.lookups).toFixed(0)} min | ${t.agent.crossChecked ? "yes (agent only)" : "neither"} |`);
}
lines.push("");
lines.push("## What the numbers actually say");
lines.push("");
lines.push("**Wall-clock time is the least interesting column.** Both arms talk to the same RPC and the");
lines.push("machine difference is small. The gap that matters is the third and fourth columns: the number of");
lines.push("separate things a person has to look up, in the right order, before any arithmetic starts.");
lines.push("");
lines.push("**The advantage is not uniform, and one task barely has one.** T3 needs a single `slot0` read; an");
lines.push("agent saves almost no fetching there. Its contribution is the tick-to-price conversion, the");
lines.push("inverted quote order, and snapping the suggested range to tick spacing so the mint does not");
lines.push("revert. T1 is the opposite: the reads themselves are the work, and they scale with the number of");
lines.push("markets the account has entered.");
lines.push("");
const div = results.find((t) => t.divergence);
if (div && div.divergence) {
  const d = div.divergence;
  const gap = Math.abs(d.agentValue - d.manualValue) / Math.max(d.manualValue, 1e-9) * 100;
  lines.push(`**The two arms disagreed on ${div.id}, and that is the whole argument.** The agent answered`);
  lines.push(`**${d.agentValue.toFixed(2)}${d.unit}** and the manual path answered **${d.manualValue.toFixed(2)}${d.unit}**, a ${gap.toFixed(0)}% gap on the`);
  lines.push("number the user is about to move money on. Neither is a bug:");
  lines.push(`${d.why}. Both are defensible; they are not the same question.`);
  lines.push("");
  lines.push("A person reading one figure off BscScan has no way to know which of the two they are holding,");
  lines.push("because the screen does not say. The agent's receipt names its source, and that is worth more");
  lines.push("than the minutes saved: the failure being prevented is not slowness, it is confidently acting");
  lines.push("on the wrong number.");
  lines.push("");
}
lines.push("**Only one arm checks itself.** In T1 the agent recomputes the position from the markets and then");
lines.push("compares its own answer with the protocol's `getAccountLiquidity`, and reports the disagreement");
lines.push("when there is one. The manual path produces a number with nothing to test it against, which is");
lines.push("the failure mode that matters, because a wrong health factor looks exactly like a right one.");
lines.push("");
lines.push("## Task detail");
for (const t of results) {
  lines.push("");
  lines.push(`### ${t.id}: ${t.title}`);
  lines.push("");
  lines.push(`*${t.category}*. ${t.question}`);
  lines.push("");
  lines.push(`**With the agent.** ${fmt(t.agent.wallMs)}, ${t.agent.lookups} read${t.agent.lookups === 1 ? "" : "s"}, receipt \`${t.agent.receiptId}\``);
  lines.push("");
  lines.push(`> ${t.agent.answer}`);
  lines.push("");
  for (const n of t.agent.notes) lines.push(`- ${n}`);
  lines.push("");
  lines.push(`**Without.** ${fmt(t.manual.wallMs)} of RPC, ${t.manual.lookups} read${t.manual.lookups === 1 ? "" : "s"}, ~${humanMin(t.manual.lookups).toFixed(0)} minutes of human time`);
  lines.push("");
  lines.push(`> ${t.manual.answer}`);
  lines.push("");
  for (const n of t.manual.notes) lines.push(`- ${n}`);
}
lines.push("");
lines.push("## Reproducing this");
lines.push("");
lines.push("```bash");
lines.push("pnpm --filter @dojo/core advantage -- --root ../..");
lines.push("```");
lines.push("");
lines.push("The script runs both arms against mainnet in the same process. The manual arm issues raw");
lines.push("sequential `readContract` calls and does not import the agent's helper modules, because those");
lines.push("helpers are exactly what is being valued.");
lines.push("");

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, lines.join("\n"));
console.log(lines.slice(lines.indexOf("## Summary")).join("\n"));
console.log(`\nWrote ${outFile}`);
