import { createPublicClient, createWalletClient, http, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainConfig } from "./chains";
import { identityRegistryAbi, reputationRegistryAbi } from "./abi";

const clients = new Map<number, PublicClient>();

export function publicClient(chainId: number): PublicClient {
  let c = clients.get(chainId);
  if (!c) {
    const cfg = chainConfig(chainId);
    c = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl, { timeout: 15_000, retryCount: 2 }) });
    clients.set(chainId, c);
  }
  return c;
}

export interface OnchainAgent {
  chainId: number;
  tokenId: string;
  uri: string | null;
  owner: Address | null;
  agentWallet: Address | null;
  errors: string[];
}

/** Reads the three facts the registry can attest to for an agent id. Each read fails independently. */
export async function readAgent(chainId: number, tokenId: bigint): Promise<OnchainAgent> {
  const cfg = chainConfig(chainId);
  const pc = publicClient(chainId);
  const out: OnchainAgent = { chainId, tokenId: tokenId.toString(), uri: null, owner: null, agentWallet: null, errors: [] };
  const base = { address: cfg.identityRegistry, abi: identityRegistryAbi } as const;
  const [uri, owner, wallet] = await Promise.allSettled([
    pc.readContract({ ...base, functionName: "tokenURI", args: [tokenId] }),
    pc.readContract({ ...base, functionName: "ownerOf", args: [tokenId] }),
    pc.readContract({ ...base, functionName: "getAgentWallet", args: [tokenId] }),
  ]);
  if (uri.status === "fulfilled") out.uri = uri.value as string; else out.errors.push(`tokenURI: ${short(uri.reason)}`);
  if (owner.status === "fulfilled") out.owner = owner.value as Address; else out.errors.push(`ownerOf: ${short(owner.reason)}`);
  if (wallet.status === "fulfilled") out.agentWallet = wallet.value as Address; else out.errors.push(`getAgentWallet: ${short(wallet.reason)}`);
  return out;
}

export interface ReputationSummary {
  count: number;
  /** mean feedback value (registry values are typically 0..100) */
  value: number | null;
  rawValue: string | null;
  decimals: number;
  /** distinct feedback authors; one wallet posting 50 times is not 50 endorsements */
  clients?: number;
  byTag?: Record<string, { count: number; mean: number }>;
}

/**
 * getSummary with an empty client list returns 0 on the live registry even when feedback rows exist,
 * so the summary is derived from readAllFeedback (non-revoked rows) and getSummary is only a fallback.
 */
export async function reputationSummary(chainId: number, tokenId: bigint, tag1 = "", tag2 = ""): Promise<ReputationSummary> {
  const rows = (await readAllFeedback(chainId, tokenId)).filter((r) => !r.revoked && (!tag1 || r.tag1 === tag1) && (!tag2 || r.tag2 === tag2));
  if (rows.length > 0) {
    const mean = rows.reduce((s, r) => s + r.value, 0) / rows.length;
    const byTag: Record<string, { count: number; mean: number }> = {};
    for (const r of rows) {
      const k = r.tag1 || "(untagged)";
      const b = (byTag[k] ??= { count: 0, mean: 0 });
      b.mean = (b.mean * b.count + r.value) / (b.count + 1);
      b.count++;
    }
    return { count: rows.length, value: mean, rawValue: null, decimals: 0, clients: new Set(rows.map((r) => r.client.toLowerCase())).size, byTag };
  }
  const cfg = chainConfig(chainId);
  const pc = publicClient(chainId);
  try {
    const [count, summaryValue, decimals] = (await pc.readContract({
      address: cfg.reputationRegistry, abi: reputationRegistryAbi, functionName: "getSummary", args: [tokenId, [], tag1, tag2],
    })) as [bigint, bigint, number];
    const n = Number(count);
    return { count: n, value: n === 0 ? null : Number(summaryValue) / 10 ** Number(decimals), rawValue: summaryValue.toString(), decimals: Number(decimals), clients: n ? undefined : 0, byTag: {} };
  } catch {
    return { count: 0, value: null, rawValue: null, decimals: 0, clients: 0, byTag: {} };
  }
}

export interface FeedbackRow { client: Address; index: number; value: number; tag1: string; tag2: string; revoked: boolean }

export async function readAllFeedback(chainId: number, tokenId: bigint): Promise<FeedbackRow[]> {
  const cfg = chainConfig(chainId);
  const pc = publicClient(chainId);
  try {
    const [clients_, idx, values, decs, t1, t2, rev] = (await pc.readContract({
      address: cfg.reputationRegistry, abi: reputationRegistryAbi, functionName: "readAllFeedback", args: [tokenId, [], "", "", true],
    })) as [Address[], bigint[], bigint[], number[], string[], string[], boolean[]];
    return clients_.map((c, i) => ({ client: c, index: Number(idx[i]), value: Number(values[i]) / 10 ** Number(decs[i]), tag1: t1[i], tag2: t2[i], revoked: rev[i] }));
  } catch {
    return [];
  }
}

export interface GiveFeedbackParams {
  tokenId: bigint;
  /** score in [0, 100], written with 2 decimals */
  score: number;
  tag1: string;
  tag2?: string;
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: Hex;
}

/** Posts a graded score to the ERC-8004 ReputationRegistry. Testnet-first: refuse mainnet unless explicitly allowed. */
export async function giveFeedback(chainId: number, privateKey: Hex, p: GiveFeedbackParams, opts: { allowMainnet?: boolean } = {}): Promise<Hex> {
  const cfg = chainConfig(chainId);
  if (!cfg.testnet && !opts.allowMainnet) throw new Error("giveFeedback on mainnet requires allowMainnet: true");
  const account = privateKeyToAccount(privateKey);
  const wc: WalletClient = createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpcUrl) });
  const value = BigInt(Math.round(Math.max(0, Math.min(100, p.score)) * 100));
  return wc.writeContract({
    address: cfg.reputationRegistry, abi: reputationRegistryAbi, functionName: "giveFeedback", chain: cfg.chain, account,
    args: [p.tokenId, value, 2, p.tag1, p.tag2 ?? "", p.endpoint ?? "", p.feedbackURI ?? "", p.feedbackHash ?? ("0x" + "0".repeat(64)) as Hex],
  });
}

function short(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.split("\n")[0].slice(0, 120);
}
