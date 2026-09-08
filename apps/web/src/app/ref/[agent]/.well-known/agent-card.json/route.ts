import { NextResponse } from "next/server";
import { REF_AGENTS, agentCard, type RefAgentName } from "@dojo/core";
import { baseUrl } from "@/lib/base-url";

export async function GET(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const def = REF_AGENTS[agent as RefAgentName];
  if (!def) return NextResponse.json({ error: "unknown agent" }, { status: 404 });
  return NextResponse.json(agentCard(def, baseUrl(req)), { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
}
