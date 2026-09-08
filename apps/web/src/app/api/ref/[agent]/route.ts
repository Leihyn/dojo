import { NextResponse } from "next/server";
import { REF_AGENTS, runRefAgent, type RefAgentName } from "@dojo/core";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, x-payment", "access-control-allow-methods": "GET, POST, OPTIONS" };

export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function GET(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const def = REF_AGENTS[agent as RefAgentName];
  if (!def) return NextResponse.json({ error: "unknown agent" }, { status: 404, headers: cors });
  return NextResponse.json({ agent: def.name, title: def.title, category: def.category, card: `${baseUrl(req)}/ref/${def.name}/.well-known/agent-card.json`, usage: `POST JSON to this URL`, sampleInput: def.sampleInput }, { headers: cors });
}

export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const def = REF_AGENTS[agent as RefAgentName];
  if (!def) return NextResponse.json({ error: "unknown agent" }, { status: 404, headers: cors });
  const input = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const agentKey = process.env[`DOJO_REF_KEY_${def.name.replace(/-/g, "_").toUpperCase()}`] || `seed:${def.name}`;
  try {
    const out = await runRefAgent(def.name, input, { agentKey });
    return NextResponse.json({ agent: def.name, ...out }, { headers: cors });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400, headers: cors });
  }
}
