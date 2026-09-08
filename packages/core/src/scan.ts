/**
 * 8004scan public API client. Anonymous tier is 30 req/min and 1,000 req/day; a free key raises that to
 * 600/min and 100k/day. Every call goes through a pacing gate and an on-disk cache so an index run
 * stays inside the anonymous budget.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const SCAN_BASE = "https://api.8004scan.io/api/v1";

export interface ScanAgent {
  id: string;
  agent_id: string;
  token_id: string;
  chain_id: number;
  contract_address: string;
  is_testnet: boolean;
  owner_address: string | null;
  agent_wallet?: string | null;
  name: string | null;
  description: string | null;
  image_url: string | null;
  supported_protocols: string[];
  x402_supported: boolean;
  is_active?: boolean | null;
  is_endpoint_verified?: boolean | null;
  health_status?: string | null;
  health_score?: number | null;
  total_score: number | null;
  total_feedbacks: number | null;
  average_score: number | null;
  tags?: string[];
  categories?: string[];
  services?: Record<string, { endpoint?: string; version?: string; skills?: unknown[] }>;
  a2a_endpoint?: string | null;
  mcp_server?: string | null;
  agent_url?: string | null;
  raw_metadata?: unknown;
  scores?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ListParams {
  chainId: number;
  limit?: number;
  offset?: number;
  hasA2a?: boolean;
  hasMcp?: boolean;
  x402?: boolean;
  endpointVerified?: boolean;
  active?: boolean;
}

export interface ScanClientOptions {
  apiKey?: string;
  cacheDir?: string;
  /** cache TTL in seconds; listing pages default to 10 min, details to 6 h */
  ttlSec?: number;
  fetchImpl?: typeof fetch;
}

export class ScanClient {
  private nextAllowedAt = 0;
  private readonly minIntervalMs: number;
  constructor(private readonly opts: ScanClientOptions = {}) {
    this.minIntervalMs = opts.apiKey ? 120 : 2_100;
  }

  async listAgents(p: ListParams): Promise<{ items: ScanAgent[]; total: number }> {
    const q = new URLSearchParams({ chain_id: String(p.chainId), limit: String(p.limit ?? 50), offset: String(p.offset ?? 0) });
    if (p.hasA2a !== undefined) q.set("has_a2a", String(p.hasA2a));
    if (p.hasMcp !== undefined) q.set("has_mcp", String(p.hasMcp));
    if (p.x402 !== undefined) q.set("x402_supported", String(p.x402));
    if (p.endpointVerified !== undefined) q.set("is_endpoint_verified", String(p.endpointVerified));
    if (p.active !== undefined) q.set("is_active", String(p.active));
    const d = await this.get<{ items: ScanAgent[]; total: number }>(`/agents?${q}`, 600);
    return { items: d.items ?? [], total: d.total ?? 0 };
  }

  getAgent(chainId: number, tokenId: string): Promise<ScanAgent> {
    return this.get<ScanAgent>(`/agents/${chainId}/${tokenId}`, 6 * 3600);
  }

  getQuality(chainId: number, tokenId: string): Promise<Record<string, unknown>> {
    return this.get(`/agents/${chainId}/${tokenId}/quality`, 6 * 3600);
  }

  listFeedbacks(chainId: number, tokenId: string, limit = 50): Promise<{ items: unknown[]; total: number }> {
    return this.get(`/feedbacks?chain_id=${chainId}&agent_token_id=${tokenId}&limit=${limit}`, 3600);
  }

  private async get<T>(pathname: string, ttlSec: number): Promise<T> {
    const cached = await this.readCache<T>(pathname, this.opts.ttlSec ?? ttlSec);
    if (cached) return cached;
    await this.pace();
    const f = this.opts.fetchImpl ?? fetch;
    const headers: Record<string, string> = { accept: "application/json", "user-agent": "dojo-indexer/0.1" };
    if (this.opts.apiKey) headers["X-API-Key"] = this.opts.apiKey;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await f(`${SCAN_BASE}${pathname}`, { headers });
      if (res.status === 429) {
        const wait = 61_000;
        console.warn(`[scan] 429 on ${pathname}; sleeping ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      // A 5xx is the upstream having a bad moment, not a bad request. Back off and try again;
      // failing the whole index run because one filter blipped is not acceptable.
      if (res.status >= 500) {
        const wait = 2_000 * (attempt + 1);
        console.warn(`[scan] ${res.status} on ${pathname}; retry ${attempt + 1}/3 in ${wait / 1000}s`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`8004scan ${res.status} for ${pathname}`);
      const remaining = Number(res.headers.get("x-ratelimit-remaining-minute") ?? "1");
      if (remaining <= 1) this.nextAllowedAt = Date.now() + 61_000;
      const json = (await res.json()) as T;
      await this.writeCache(pathname, json);
      return json;
    }
    throw new Error(`8004scan unavailable after 3 attempts for ${pathname}`);
  }

  private async pace() {
    const now = Date.now();
    if (now < this.nextAllowedAt) await sleep(this.nextAllowedAt - now);
    this.nextAllowedAt = Date.now() + this.minIntervalMs;
  }

  private cachePath(pathname: string): string | null {
    if (!this.opts.cacheDir) return null;
    const h = createHash("sha1").update(pathname).digest("hex").slice(0, 16);
    return path.join(this.opts.cacheDir, "scan", `${h}.json`);
  }

  private async readCache<T>(pathname: string, ttlSec: number): Promise<T | null> {
    const p = this.cachePath(pathname);
    if (!p) return null;
    try {
      const raw = JSON.parse(await readFile(p, "utf8")) as { at: number; body: T };
      if (Date.now() - raw.at > ttlSec * 1000) return null;
      return raw.body;
    } catch {
      return null;
    }
  }

  private async writeCache(pathname: string, body: unknown) {
    const p = this.cachePath(pathname);
    if (!p) return;
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify({ at: Date.now(), body }));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
