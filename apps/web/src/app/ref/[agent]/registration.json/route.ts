import { NextResponse } from "next/server";
import { REF_AGENTS, registrationFile, type RefAgentName } from "@dojo/core";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

/** The ERC-8004 registration file the Identity Registry points at for each reference agent. */
export async function GET(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const def = REF_AGENTS[agent as RefAgentName];
  if (!def) return NextResponse.json({ error: "unknown agent" }, { status: 404 });
  return NextResponse.json(registrationFile(def, baseUrl(req)), {
    headers: { "cache-control": "public, max-age=60" },
  });
}
