/** PancakeSwap reads and the pure planning math behind the grid and rebalancing reference agents. */
import type { Address } from "viem";
import { publicClient } from "./registry";
import type { ToolCall } from "./receipts";

export const PCS_V2_USDT_WBNB: Address = "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE"; // token0 USDT, token1 WBNB
export const PCS_V3_USDT_WBNB_500: Address = "0x36696169C63e42cd08ce11f5deeBbCeBae652050"; // token0 USDT, token1 WBNB, fee 500, tickSpacing 10

const v2Abi = [{ type: "function", name: "getReserves", stateMutability: "view", inputs: [], outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] }] as const;
const v3Abi = [
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [{ type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint32" }, { type: "bool" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
] as const;

/** USDT per WBNB from the v2 pair (token0 USDT / token1 WBNB, both 18 decimals). */
export async function readV2Price(calls: ToolCall[] = []): Promise<number> {
  const t0 = Date.now();
  const [r0, r1] = (await publicClient(56).readContract({ address: PCS_V2_USDT_WBNB, abi: v2Abi, functionName: "getReserves" })) as readonly [bigint, bigint, number];
  calls.push({ tool: "pancake.v2.getReserves", args: { pair: PCS_V2_USDT_WBNB }, provenance: "live", latencyMs: Date.now() - t0, source: PCS_V2_USDT_WBNB });
  return Number(r0 * BigInt(10) ** BigInt(6) / r1) / 1e6;
}

export interface V3State { sqrtPriceX96: bigint; tick: number; liquidity: bigint; priceUsdtPerBnb: number }

export async function readV3State(calls: ToolCall[] = []): Promise<V3State> {
  const t0 = Date.now();
  const pc = publicClient(56);
  const [slot, liq] = await Promise.all([
    pc.readContract({ address: PCS_V3_USDT_WBNB_500, abi: v3Abi, functionName: "slot0" }),
    pc.readContract({ address: PCS_V3_USDT_WBNB_500, abi: v3Abi, functionName: "liquidity" }),
  ]);
  const [sqrtPriceX96, tick] = slot as readonly [bigint, number, number, number, number, number, boolean];
  calls.push({ tool: "pancake.v3.slot0", args: { pool: PCS_V3_USDT_WBNB_500 }, provenance: "live", latencyMs: Date.now() - t0, source: PCS_V3_USDT_WBNB_500 });
  // price = token1 per token0 = WBNB per USDT; invert for USDT per WBNB. Equal decimals so no scaling.
  const bnbPerUsdt = sqrtToPrice(sqrtPriceX96);
  return { sqrtPriceX96, tick, liquidity: liq as bigint, priceUsdtPerBnb: 1 / bnbPerUsdt };
}

export function sqrtToPrice(sqrtPriceX96: bigint): number { const s = Number(sqrtPriceX96) / 2 ** 96; return s * s; }
export function tickToPrice(tick: number): number { return 1.0001 ** tick; }
export function priceToTick(price: number): number { return Math.floor(Math.log(price) / Math.log(1.0001)); }

export interface GridOrder { level: number; price: number; side: "buy" | "sell"; sizeUsd: number }
export interface GridPlan { lower: number; upper: number; levels: number; spacingPct: number; orders: GridOrder[]; perLevelUsd: number; currentPrice: number; warnings: string[] }

/** Pure: evenly spaced (geometric) grid between lower and upper; buys below current, sells above. */
export function planGrid(p: { currentPrice: number; lower: number; upper: number; levels: number; budgetUsd: number }): GridPlan {
  const warnings: string[] = [];
  if (!(p.lower > 0 && p.upper > p.lower)) throw new Error("need 0 < lower < upper");
  if (p.levels < 2 || p.levels > 200) throw new Error("levels must be 2..200");
  if (p.currentPrice < p.lower || p.currentPrice > p.upper) warnings.push("current price is outside the grid; one side will not fill until price re-enters");
  const ratio = (p.upper / p.lower) ** (1 / (p.levels - 1));
  const perLevelUsd = p.budgetUsd / p.levels;
  const orders: GridOrder[] = [];
  for (let i = 0; i < p.levels; i++) {
    const price = p.lower * ratio ** i;
    orders.push({ level: i, price: round(price, 6), side: price < p.currentPrice ? "buy" : "sell", sizeUsd: round(perLevelUsd, 2) });
  }
  const spacingPct = (ratio - 1) * 100;
  if (spacingPct < 0.15) warnings.push(`grid spacing ${spacingPct.toFixed(3)}% is below typical swap fee plus slippage; each fill may lose money`);
  return { lower: p.lower, upper: p.upper, levels: p.levels, spacingPct: round(spacingPct, 4), orders, perLevelUsd: round(perLevelUsd, 2), currentPrice: p.currentPrice, warnings };
}

export interface RangeCheck { inRange: boolean; currentTick: number; tickLower: number; tickUpper: number; distanceToEdgePct: number; widthPct: number; suggestion: { tickLower: number; tickUpper: number; lowerPrice: number; upperPrice: number } | null; action: "hold" | "rebalance-now" | "prepare" }

/** Pure: is a v3 position in range, and if not (or nearly not), what range would recentre it. Prices are token1/token0 in tick space. */
export function checkRange(p: { currentTick: number; tickLower: number; tickUpper: number; tickSpacing: number; targetWidthPct?: number; edgeThresholdPct?: number }): RangeCheck {
  if (p.tickUpper <= p.tickLower) throw new Error("tickUpper must exceed tickLower");
  const cur = tickToPrice(p.currentTick), lo = tickToPrice(p.tickLower), hi = tickToPrice(p.tickUpper);
  const inRange = p.currentTick >= p.tickLower && p.currentTick < p.tickUpper;
  const widthPct = (hi / lo - 1) * 100;
  const distanceToEdgePct = inRange ? Math.min(cur / lo - 1, hi / cur - 1) * 100 : -Math.min(Math.abs(cur / lo - 1), Math.abs(cur / hi - 1)) * 100;
  const threshold = p.edgeThresholdPct ?? 1;
  const width = p.targetWidthPct ?? widthPct;
  const half = Math.log(1 + width / 200) / Math.log(1.0001);
  const snap = (t: number) => Math.round(t / p.tickSpacing) * p.tickSpacing;
  const suggestion = { tickLower: snap(p.currentTick - half), tickUpper: snap(p.currentTick + half), lowerPrice: 0, upperPrice: 0 };
  suggestion.lowerPrice = round(tickToPrice(suggestion.tickLower), 8); suggestion.upperPrice = round(tickToPrice(suggestion.tickUpper), 8);
  const action: RangeCheck["action"] = !inRange ? "rebalance-now" : distanceToEdgePct < threshold ? "prepare" : "hold";
  return { inRange, currentTick: p.currentTick, tickLower: p.tickLower, tickUpper: p.tickUpper, distanceToEdgePct: round(distanceToEdgePct, 4), widthPct: round(widthPct, 4), suggestion: action === "hold" ? null : suggestion, action };
}

function round(x: number, d: number) { const f = 10 ** d; return Math.round(x * f) / f; }
