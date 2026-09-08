import { z } from "zod";

export const REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

const serviceSchema = z.object({
  name: z.string(),
  endpoint: z.string(),
  version: z.string().optional(),
  skills: z.array(z.unknown()).optional(),
  domains: z.array(z.unknown()).optional(),
}).passthrough();

export const registrationSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  services: z.array(serviceSchema).optional(),
  x402Support: z.boolean().optional(),
  active: z.boolean().optional(),
  registrations: z.array(z.unknown()).optional(),
  supportedTrust: z.array(z.string()).optional(),
}).passthrough();

export type Registration = z.infer<typeof registrationSchema>;

export interface ResolvedRegistration {
  ok: boolean;
  source: "data-uri" | "ipfs" | "http" | "none";
  registration: Registration | null;
  /** Schema-level problems that do not block parsing (missing type, no services, ...). */
  warnings: string[];
  error?: string;
}

const FETCH_TIMEOUT_MS = 8_000;

export async function resolveRegistration(uri: string | null | undefined, fetchImpl: typeof fetch = fetch): Promise<ResolvedRegistration> {
  if (!uri || uri.trim() === "") return { ok: false, source: "none", registration: null, warnings: [], error: "empty agentURI" };
  try {
    let raw: string;
    let source: ResolvedRegistration["source"];
    if (uri.startsWith("data:")) {
      source = "data-uri";
      raw = decodeDataUri(uri);
    } else if (uri.startsWith("ipfs://")) {
      source = "ipfs";
      raw = await fetchText(`https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`, fetchImpl);
    } else if (/^https?:\/\//i.test(uri)) {
      source = "http";
      raw = await fetchText(uri, fetchImpl);
    } else {
      return { ok: false, source: "none", registration: null, warnings: [], error: `unsupported URI scheme: ${uri.slice(0, 40)}` };
    }
    const json = JSON.parse(raw);
    const parsed = registrationSchema.safeParse(json);
    if (!parsed.success) return { ok: false, source, registration: null, warnings: [], error: `schema: ${parsed.error.issues[0]?.message}` };
    const reg = parsed.data;
    const warnings: string[] = [];
    if (reg.type !== REGISTRATION_TYPE) warnings.push(reg.type ? `non-standard type: ${reg.type.slice(0, 60)}` : "missing type");
    if (!reg.name) warnings.push("missing name");
    if (!reg.description) warnings.push("missing description");
    if (!reg.services?.length) warnings.push("no services advertised");
    for (const s of reg.services ?? []) if (/\{[a-zA-Z_]+\}/.test(s.endpoint)) warnings.push(`${s.name} endpoint has unresolved template ${s.endpoint.match(/\{[a-zA-Z_]+\}/)?.[0]}`);
    return { ok: true, source, registration: reg, warnings };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, source: uri.startsWith("data:") ? "data-uri" : uri.startsWith("ipfs://") ? "ipfs" : "http", registration: null, warnings: [], error: msg.slice(0, 160) };
  }
}

export function decodeDataUri(uri: string): string {
  const comma = uri.indexOf(",");
  if (comma < 0) throw new Error("malformed data URI");
  const header = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  if (/;base64/i.test(header)) return Buffer.from(payload, "base64").toString("utf8");
  return decodeURIComponent(payload);
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: "application/json", "user-agent": "dojo-indexer/0.1" }, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 512_000) throw new Error("registration file too large");
    return text;
  } finally {
    clearTimeout(t);
  }
}

/** Pull typed endpoints out of a registration's services list. */
export function serviceEndpoints(reg: Registration | null): { a2a?: string; mcp?: string; web?: string; other: Record<string, string> } {
  const out: { a2a?: string; mcp?: string; web?: string; other: Record<string, string> } = { other: {} };
  for (const s of reg?.services ?? []) {
    const n = s.name.toLowerCase();
    if (n === "a2a" && !out.a2a) out.a2a = s.endpoint;
    else if (n === "mcp" && !out.mcp) out.mcp = s.endpoint;
    else if (n === "web" && !out.web) out.web = s.endpoint;
    else out.other[s.name] = s.endpoint;
  }
  return out;
}
