import { NextResponse } from "next/server";
import { probeAll, summarize } from "@dojo/core";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { endpoints?: { a2a?: string; mcp?: string; web?: string } };
  const ep = body.endpoints ?? {};
  const urls = [ep.a2a, ep.mcp, ep.web].filter(Boolean) as string[];
  if (urls.length === 0 || urls.length > 3) return NextResponse.json({ error: "give 1 to 3 endpoints" }, { status: 400 });
  for (const u of urls) if (!/^https?:\/\//i.test(u) || /localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|169\.254\./i.test(u)) return NextResponse.json({ error: `refusing to probe ${u}` }, { status: 400 });
  const probes = await probeAll(ep);
  return NextResponse.json({ status: summarize(probes), probes });
}
