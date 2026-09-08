import { NextResponse } from "next/server";
import { getEntry } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/**
 * Pay-per-call activation. Runs server-side because third-party x402 endpoints rarely allow the
 * X-PAYMENT header through CORS. Requires a funded testnet session; until DOJO_SESSION_KEY is set
 * this route reports exactly what is missing instead of pretending.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: string; task?: string };
  const e = body.key ? getEntry(body.key) : undefined;
  if (!e) return NextResponse.json({ error: "unknown agent" }, { status: 404 });
  const endpoint = e.endpoints.mcp ?? e.endpoints.a2a ?? e.endpoints.web;
  if (!endpoint) return NextResponse.json({ error: "agent advertises no endpoint to call" }, { status: 400 });
  if (!process.env.DOJO_SESSION_KEY) {
    return NextResponse.json({ error: "activation wallet not configured on this deployment (DOJO_SESSION_KEY missing); nothing was paid or called", endpoint, status: "NOT_CONFIGURED" }, { status: 501 });
  }
  return NextResponse.json({ error: "x402 client not wired yet", endpoint, status: "PROPOSED" }, { status: 501 });
}
