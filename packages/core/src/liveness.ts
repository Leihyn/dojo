/**
 * Liveness probes. A registry entry is a claim; a probe is evidence. Each probe records what was
 * tried, what came back, and how long it took, so the catalog can show "answered 2 minutes ago"
 * instead of "has endpoint".
 */
export type ProbeKind = "a2a" | "mcp" | "web";
export type ProbeState = "live" | "gated" | "dead" | "unresolved" | "skipped";

export interface AgentCardSummary { name?: string; description?: string; skills: string[] }

export interface Probe {
  kind: ProbeKind;
  endpoint: string;
  state: ProbeState;
  /** A2A only: what the agent card says about itself, used for naming and classification. */
  card?: AgentCardSummary;
  httpStatus?: number;
  latencyMs?: number;
  evidence?: string;
  error?: string;
  checkedAt: string;
}

const TIMEOUT_MS = 8_000;
const UA = "dojo-liveness/0.1";

export async function probeAll(ep: { a2a?: string; mcp?: string; web?: string }, fetchImpl: typeof fetch = fetch): Promise<Probe[]> {
  const jobs: Promise<Probe>[] = [];
  if (ep.a2a) jobs.push(probeA2A(ep.a2a, fetchImpl));
  if (ep.mcp) jobs.push(probeMcp(ep.mcp, fetchImpl));
  if (ep.web) jobs.push(probeWeb(ep.web, fetchImpl));
  return Promise.all(jobs);
}

/** A2A: the endpoint should serve an agent card JSON (name, url, skills). */
export async function probeA2A(endpoint: string, fetchImpl: typeof fetch = fetch): Promise<Probe> {
  const base: Probe = { kind: "a2a", endpoint, state: "dead", checkedAt: new Date().toISOString() };
  if (hasTemplate(endpoint)) return { ...base, state: "unresolved", error: "endpoint contains an unresolved template placeholder" };
  if (!isHttp(endpoint)) return { ...base, state: "unresolved", error: "not an http(s) URL" };
  const t0 = Date.now();
  try {
    const res = await timedFetch(endpoint, { headers: { accept: "application/json", "user-agent": UA } }, fetchImpl);
    const latencyMs = Date.now() - t0;
    if (res.status === 401 || res.status === 402 || res.status === 403) return { ...base, state: "gated", httpStatus: res.status, latencyMs, evidence: `answered ${res.status} (auth or payment required)` };
    if (!res.ok) return { ...base, state: "dead", httpStatus: res.status, latencyMs, error: `HTTP ${res.status}` };
    const text = await res.text();
    let card: Record<string, unknown> | null = null;
    try { card = JSON.parse(text); } catch { /* not json */ }
    if (!card || typeof card !== "object") return { ...base, state: "dead", httpStatus: res.status, latencyMs, error: "200 but body is not an agent card" };
    const skillList = Array.isArray(card.skills) ? card.skills : [];
    const skills = skillList.map((k) => (k && typeof k === "object" ? String((k as Record<string, unknown>).name ?? (k as Record<string, unknown>).id ?? "") : String(k))).filter(Boolean).slice(0, 20);
    const name = typeof card.name === "string" ? card.name : "";
    const description = typeof card.description === "string" ? card.description.slice(0, 500) : undefined;
    return { ...base, state: "live", httpStatus: res.status, latencyMs, card: { name: name || undefined, description, skills }, evidence: `agent card${name ? ` "${name.slice(0, 40)}"` : ""}, ${skillList.length} skill${skillList.length === 1 ? "" : "s"}` };
  } catch (e) {
    return { ...base, state: "dead", latencyMs: Date.now() - t0, error: errMsg(e) };
  }
}

/** MCP over streamable HTTP: an initialize request should return serverInfo/capabilities. */
export async function probeMcp(endpoint: string, fetchImpl: typeof fetch = fetch): Promise<Probe> {
  const base: Probe = { kind: "mcp", endpoint, state: "dead", checkedAt: new Date().toISOString() };
  if (hasTemplate(endpoint)) return { ...base, state: "unresolved", error: "endpoint contains an unresolved template placeholder" };
  if (!isHttp(endpoint)) return { ...base, state: "unresolved", error: "not an http(s) URL" };
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "dojo", version: "0.1" } } });
  const t0 = Date.now();
  try {
    const res = await timedFetch(endpoint, { method: "POST", body, headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "user-agent": UA } }, fetchImpl);
    const latencyMs = Date.now() - t0;
    if (res.status === 401 || res.status === 402 || res.status === 403) return { ...base, state: "gated", httpStatus: res.status, latencyMs, evidence: `answered ${res.status} (auth or payment required)` };
    const text = (await res.text()).slice(0, 20_000);
    if (res.ok && /serverInfo|capabilities|protocolVersion/.test(text)) {
      const m = text.match(/"name"\s*:\s*"([^"]{1,60})"/);
      return { ...base, state: "live", httpStatus: res.status, latencyMs, evidence: `initialize ok${m ? ` (${m[1]})` : ""}` };
    }
    // Legacy MCP transport: a GET with text/event-stream answers with an `endpoint` event.
    const sse = await probeMcpSse(endpoint, fetchImpl);
    if (sse) return { ...base, ...sse, latencyMs: Date.now() - t0 };
    if (res.status === 405 || res.status === 406) return { ...base, state: "gated", httpStatus: res.status, latencyMs, evidence: "endpoint exists but rejects both streamable-http initialize and SSE" };
    return { ...base, state: "dead", httpStatus: res.status, latencyMs, error: res.ok ? "200 without MCP initialize result" : `HTTP ${res.status}` };
  } catch (e) {
    return { ...base, state: "dead", latencyMs: Date.now() - t0, error: errMsg(e) };
  }
}

async function probeMcpSse(endpoint: string, fetchImpl: typeof fetch): Promise<Pick<Probe, "state" | "httpStatus" | "evidence"> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4_000);
  try {
    const res = await fetchImpl(endpoint, { headers: { accept: "text/event-stream", "user-agent": UA }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const { value } = await reader.read();
    const head = value ? new TextDecoder().decode(value).slice(0, 2000) : "";
    reader.cancel().catch(() => {});
    if (/event:\s*endpoint|"jsonrpc"/.test(head)) return { state: "live", httpStatus: res.status, evidence: "MCP over SSE (legacy transport) answered" };
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function probeWeb(endpoint: string, fetchImpl: typeof fetch = fetch): Promise<Probe> {
  const base: Probe = { kind: "web", endpoint, state: "dead", checkedAt: new Date().toISOString() };
  if (!isHttp(endpoint)) return { ...base, state: "unresolved", error: "not an http(s) URL" };
  const t0 = Date.now();
  try {
    const res = await timedFetch(endpoint, { method: "GET", headers: { "user-agent": UA } }, fetchImpl);
    const latencyMs = Date.now() - t0;
    if (res.status >= 500) return { ...base, state: "dead", httpStatus: res.status, latencyMs, error: `HTTP ${res.status}` };
    if (res.status === 404) return { ...base, state: "dead", httpStatus: 404, latencyMs, error: "HTTP 404" };
    return { ...base, state: "live", httpStatus: res.status, latencyMs, evidence: `HTTP ${res.status}` };
  } catch (e) {
    return { ...base, state: "dead", latencyMs: Date.now() - t0, error: errMsg(e) };
  }
}

/** Collapse probes into one status: any live > any gated > any dead > unresolved. */
export function summarize(probes: Probe[]): ProbeState {
  if (probes.length === 0) return "skipped";
  if (probes.some((p) => p.state === "live")) return "live";
  if (probes.some((p) => p.state === "gated")) return "gated";
  if (probes.some((p) => p.state === "dead")) return "dead";
  return "unresolved";
}

function hasTemplate(s: string) { return /\{[a-zA-Z_]+\}/.test(s); }
function isHttp(s: string) { return /^https?:\/\//i.test(s); }
function errMsg(e: unknown) { const m = e instanceof Error ? e.message : String(e); return m.split("\n")[0].slice(0, 120); }

async function timedFetch(url: string, init: RequestInit, fetchImpl: typeof fetch): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}
