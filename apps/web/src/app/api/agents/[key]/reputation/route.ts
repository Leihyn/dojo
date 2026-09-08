import { NextResponse } from "next/server";
import { readAllFeedback, reputationSummary } from "@dojo/core";
import { getEntry } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const e = getEntry(decodeURIComponent(key));
  if (!e) return NextResponse.json({ error: "unknown agent" }, { status: 404 });
  // Seed entries carry a slug until they are registered on-chain; there is nothing to read for them.
  if (!/^\d+$/.test(e.tokenId)) {
    return NextResponse.json({ key: e.key, readAt: new Date().toISOString(), summary: e.reputation, feedback: [], note: "not registered on-chain yet; no ERC-8004 token id to read" });
  }
  const id = BigInt(e.tokenId);
  const [summary, feedback] = await Promise.all([reputationSummary(e.chainId, id), readAllFeedback(e.chainId, id)]);
  return NextResponse.json({ key: e.key, readAt: new Date().toISOString(), summary, feedback: feedback.slice(0, 50) });
}
