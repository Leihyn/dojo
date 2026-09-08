/**
 * Venus Protocol reads on BNB Smart Chain. Every number here is derived from the Comptroller, the
 * vTokens and the protocol's own oracle, then cross-checked against getAccountLiquidity so a
 * disagreement is reported instead of a plausible figure.
 */
import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { bsc } from "viem/chains";
import { publicClient } from "./registry";
import type { ToolCall } from "./receipts";

export const VENUS_UNITROLLER: Address = "0xfD36E2c2a6789Db23113685031d7F16329158384";
export const VENUS_MARKETS: Record<string, Address> = {
  vUSDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255",
  vUSDC: "0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8",
  vBNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
  vFDUSD: "0xC4eF4229FEc74Ccfe17B2bdeF7715fAC740BA0ba",
};
/** BSC produces a block roughly every 0.75s since the Maxwell hard fork; Venus itself uses a fixed constant. Flagged in receipts. */
export const BSC_BLOCKS_PER_YEAR = 42_048_000;

const comptrollerAbi = [
  { type: "function", name: "getAssetsIn", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "address[]" }] },
  { type: "function", name: "getAccountLiquidity", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "markets", stateMutability: "view", inputs: [{ name: "vToken", type: "address" }], outputs: [{ name: "isListed", type: "bool" }, { name: "collateralFactorMantissa", type: "uint256" }, { name: "isVenus", type: "bool" }] },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;
const vTokenAbi = [
  { type: "function", name: "getAccountSnapshot", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "supplyRatePerBlock", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const oracleAbi = [{ type: "function", name: "getUnderlyingPrice", stateMutability: "view", inputs: [{ name: "vToken", type: "address" }], outputs: [{ type: "uint256" }] }] as const;

export interface MarketPosition {
  vToken: Address;
  symbol: string;
  supplyUsd: number;
  borrowUsd: number;
  collateralFactor: number;
  priceUsdPerUnderlying18: string;
}

export interface VenusHealth {
  account: Address;
  markets: MarketPosition[];
  collateralUsd: number;
  weightedCollateralUsd: number;
  borrowUsd: number;
  /** weightedCollateral / borrow; Infinity when nothing is borrowed */
  healthFactor: number;
  /** fraction the collateral can fall before shortfall; 0 when already liquidatable */
  liquidationDrawdown: number;
  protocol: { liquidityUsd: number; shortfallUsd: number };
  /** our arithmetic vs the protocol's own view, relative difference */
  crossCheck: { ok: boolean; relDiff: number };
  status: "healthy" | "watch" | "danger" | "liquidatable" | "no-borrow";
}

const E18 = BigInt(10) ** BigInt(18);

/** Pure: combine snapshots into a health view. Exported so the math is unit-testable without RPC. */
export function computeHealth(account: Address, rows: Array<{ vToken: Address; symbol: string; vTokenBalance: bigint; borrowBalance: bigint; exchangeRate: bigint; price: bigint; collateralFactor: bigint }>, protocol: { liquidity: bigint; shortfall: bigint }): VenusHealth {
  const markets: MarketPosition[] = [];
  let collateral = BigInt(0), weighted = BigInt(0), borrow = BigInt(0);
  for (const r of rows) {
    // Compound convention: all mantissas are 1e18; price already carries the underlying-decimals scaling.
    const supply18 = (r.vTokenBalance * r.exchangeRate * r.price) / (E18 * E18);
    const borrow18 = (r.borrowBalance * r.price) / E18;
    const weighted18 = (supply18 * r.collateralFactor) / E18;
    collateral += supply18; weighted += weighted18; borrow += borrow18;
    markets.push({ vToken: r.vToken, symbol: r.symbol, supplyUsd: n18(supply18), borrowUsd: n18(borrow18), collateralFactor: n18(r.collateralFactor), priceUsdPerUnderlying18: r.price.toString() });
  }
  const collateralUsd = n18(collateral), weightedCollateralUsd = n18(weighted), borrowUsd = n18(borrow);
  const healthFactor = borrowUsd === 0 ? Number.POSITIVE_INFINITY : weightedCollateralUsd / borrowUsd;
  const liquidationDrawdown = borrowUsd === 0 ? 1 : Math.max(0, 1 - borrowUsd / weightedCollateralUsd);
  const ours = weighted - borrow;
  const theirs = protocol.liquidity - protocol.shortfall;
  const scale = Math.max(1, Math.abs(n18(theirs)), Math.abs(n18(ours)));
  const relDiff = Math.abs(n18(ours) - n18(theirs)) / scale;
  const status: VenusHealth["status"] = borrowUsd === 0 ? "no-borrow" : protocol.shortfall > BigInt(0) || healthFactor < 1 ? "liquidatable" : healthFactor < 1.1 ? "danger" : healthFactor < 1.3 ? "watch" : "healthy";
  return { account, markets, collateralUsd, weightedCollateralUsd, borrowUsd, healthFactor, liquidationDrawdown, protocol: { liquidityUsd: n18(protocol.liquidity), shortfallUsd: n18(protocol.shortfall) }, crossCheck: { ok: relDiff < 0.005, relDiff }, status };
}

export async function readVenusHealth(account: Address, calls: ToolCall[] = []): Promise<VenusHealth> {
  const pc = publicClient(56);
  const c = { address: VENUS_UNITROLLER, abi: comptrollerAbi } as const;
  const t0 = Date.now();
  const [assets, liq, oracle] = await Promise.all([
    pc.readContract({ ...c, functionName: "getAssetsIn", args: [account] }),
    pc.readContract({ ...c, functionName: "getAccountLiquidity", args: [account] }),
    pc.readContract({ ...c, functionName: "oracle" }),
  ]);
  calls.push({ tool: "venus.comptroller", args: { account, fns: ["getAssetsIn", "getAccountLiquidity", "oracle"] }, provenance: "live", latencyMs: Date.now() - t0, source: VENUS_UNITROLLER });
  const rows = await Promise.all((assets as Address[]).map(async (vToken) => {
    const t1 = Date.now();
    const [snap, sym, mkt, price] = await Promise.all([
      pc.readContract({ address: vToken, abi: vTokenAbi, functionName: "getAccountSnapshot", args: [account] }),
      pc.readContract({ address: vToken, abi: vTokenAbi, functionName: "symbol" }).catch(() => "?"),
      pc.readContract({ ...c, functionName: "markets", args: [vToken] }),
      pc.readContract({ address: oracle as Address, abi: oracleAbi, functionName: "getUnderlyingPrice", args: [vToken] }),
    ]);
    const [err, vTokenBalance, borrowBalance, exchangeRate] = snap as [bigint, bigint, bigint, bigint];
    calls.push({ tool: "venus.market", args: { vToken, symbol: sym }, provenance: err === BigInt(0) ? "live" : "error", latencyMs: Date.now() - t1, source: vToken, note: err === BigInt(0) ? undefined : `snapshot error ${err}` });
    return { vToken, symbol: sym as string, vTokenBalance, borrowBalance, exchangeRate, price: price as bigint, collateralFactor: (mkt as readonly [boolean, bigint, boolean])[1] };
  }));
  const [, liquidity, shortfall] = liq as readonly [bigint, bigint, bigint];
  return computeHealth(account, rows, { liquidity, shortfall });
}

export interface StableYield { market: string; underlying: string; supplyApy: number; borrowApy: number | null; totalSupplyUsd: number | null; liquidityUsd?: number | null; priceInvalid?: boolean; source: "venus-api" | "onchain-rate" }

/** Ranks stablecoin supply yields. Prefers the Venus API; falls back to on-chain rate with an explicit blocks/year assumption. */
export async function readVenusStableYields(calls: ToolCall[] = [], fetchImpl: typeof fetch = fetch): Promise<StableYield[]> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetchImpl("https://api.venus.io/markets/core-pool?chainId=56&limit=100", { signal: ctrl.signal, headers: { accept: "application/json" } });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { result: Array<Record<string, unknown>> };
    const rows = json.result.filter((m) => m.isListed !== false && isStable(String(m.underlyingSymbol ?? "")) && !/OLD$/i.test(String(m.symbol ?? ""))).map((m) => ({
      market: String(m.symbol), underlying: String(m.underlyingSymbol), supplyApy: num(m.supplyApy), borrowApy: m.borrowApy == null ? null : num(m.borrowApy),
      totalSupplyUsd: m.totalSupplyUnderlyingCents == null ? null : num(m.totalSupplyUnderlyingCents) / 100, liquidityUsd: m.liquidityCents == null ? null : num(m.liquidityCents) / 100,
      priceInvalid: Boolean(m.isPriceInvalid), source: "venus-api" as const,
    })).filter((r) => Number.isFinite(r.supplyApy));
    calls.push({ tool: "venus.api.markets", args: { chainId: 56 }, provenance: "live", latencyMs: Date.now() - t0, source: "api.venus.io", note: `${rows.length} stable markets` });
    return rows.sort((a, b) => b.supplyApy - a.supplyApy);
  } catch (e) {
    calls.push({ tool: "venus.api.markets", args: { chainId: 56 }, provenance: "error", latencyMs: Date.now() - t0, source: "api.venus.io", note: e instanceof Error ? e.message : String(e) });
  }
  const pc = publicClient(56);
  const out: StableYield[] = [];
  for (const [sym, addr] of Object.entries(VENUS_MARKETS)) {
    if (!isStable(sym)) continue;
    const t1 = Date.now();
    try {
      const rate = (await pc.readContract({ address: addr, abi: vTokenAbi, functionName: "supplyRatePerBlock" })) as bigint;
      const apy = (1 + Number(rate) / 1e18) ** BSC_BLOCKS_PER_YEAR - 1;
      calls.push({ tool: "venus.vToken.supplyRatePerBlock", args: { vToken: addr }, provenance: "live", latencyMs: Date.now() - t1, source: addr, note: `assumes ${BSC_BLOCKS_PER_YEAR} blocks/year` });
      out.push({ market: sym, underlying: sym.slice(1), supplyApy: apy * 100, borrowApy: null, totalSupplyUsd: null, source: "onchain-rate" });
    } catch (e) {
      calls.push({ tool: "venus.vToken.supplyRatePerBlock", args: { vToken: addr }, provenance: "error", latencyMs: Date.now() - t1, note: e instanceof Error ? e.message : String(e) });
    }
  }
  return out.sort((a, b) => b.supplyApy - a.supplyApy);
}

/** Public dataseed RPCs reject eth_getLogs outright; publicnode allows 5,000-block spans. Override with BSC_LOGS_RPC_URL. */
export function logsClient() {
  return createPublicClient({ chain: bsc, transport: http(process.env.BSC_LOGS_RPC_URL ?? "https://bsc-rpc.publicnode.com", { timeout: 15_000, retryCount: 1 }) });
}

/** Recent borrowers on the biggest markets, for demos that need a real account. Scans back in 5,000-block chunks (about an hour each). */
export async function findRecentBorrowers(limit = 5, maxBlocksBack = BigInt(40_000)): Promise<Address[]> {
  const pc = logsClient();
  const head = await pc.getBlockNumber();
  const ev = parseAbiItem("event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows)");
  const seen = new Set<string>();
  const chunk = BigInt(5_000);
  for (let to = head; to > head - maxBlocksBack && seen.size < limit; to -= chunk) {
    const from = to - chunk + BigInt(1);
    for (const addr of [VENUS_MARKETS.vUSDT, VENUS_MARKETS.vBNB, VENUS_MARKETS.vUSDC]) {
      const logs = await pc.getLogs({ address: addr, event: ev, fromBlock: from, toBlock: to }).catch(() => []);
      for (const l of logs.reverse()) { const b = (l.args as { borrower?: Address }).borrower; if (b) seen.add(b); if (seen.size >= limit) break; }
      if (seen.size >= limit) break;
    }
  }
  return [...seen].slice(0, limit) as Address[];
}

export function isStable(sym: string) { return /USDT|USDC|FDUSD|DAI|BUSD|USD1|lisUSD|TUSD|USDD/i.test(sym) && !/^v?h[A-Z]/.test(sym); }
function n18(x: bigint): number { return Number(x / BigInt(10) ** BigInt(12)) / 1e6; }
function num(v: unknown): number { return typeof v === "number" ? v : Number(String(v)); }
