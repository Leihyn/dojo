import { NextResponse } from "next/server";
import { filterEntries, getCatalog } from "@/lib/catalog";

export function GET(req: Request) {
  const u = new URL(req.url);
  const entries = filterEntries({ category: u.searchParams.get("category") ?? undefined, live: u.searchParams.get("live") === "1", chainId: u.searchParams.get("chain") ? Number(u.searchParams.get("chain")) : undefined, q: u.searchParams.get("q") ?? undefined, protocol: u.searchParams.get("protocol") ?? undefined });
  const limit = Math.min(200, Number(u.searchParams.get("limit") ?? 50));
  return NextResponse.json({ builtAt: getCatalog().builtAt, total: entries.length, items: entries.slice(0, limit).map(({ probes, classification, ...rest }) => ({ ...rest, probeStates: probes.map((p) => ({ kind: p.kind, state: p.state, checkedAt: p.checkedAt })), classifiedBy: classification.matched })) });
}
