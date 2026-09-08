import { describe, expect, it } from "vitest";
import { decodeDataUri, resolveRegistration, serviceEndpoints, REGISTRATION_TYPE } from "../src/registration";

const good = { type: REGISTRATION_TYPE, name: "Health Sentinel", description: "watches health factors", services: [{ name: "MCP", endpoint: "https://x.example/mcp", version: "2025-06-18" }, { name: "web", endpoint: "https://x.example" }] };

describe("resolveRegistration", () => {
  it("parses a base64 data URI", async () => {
    const uri = "data:application/json;base64," + Buffer.from(JSON.stringify(good)).toString("base64");
    const r = await resolveRegistration(uri);
    expect(r.ok).toBe(true);
    expect(r.source).toBe("data-uri");
    expect(r.warnings).toEqual([]);
    expect(serviceEndpoints(r.registration)).toEqual({ mcp: "https://x.example/mcp", web: "https://x.example", other: {} });
  });
  it("flags empty and unsupported URIs", async () => {
    expect((await resolveRegistration("")).error).toMatch(/empty/);
    expect((await resolveRegistration("eliza-cloud bnb-consolidate")).error).toMatch(/unsupported/);
  });
  it("warns on non-standard type, missing services and template endpoints", async () => {
    const bad = { name: "x", services: [{ name: "A2A", endpoint: "https://api.example/agents/{agentId}/card" }] };
    const r = await resolveRegistration("data:application/json," + encodeURIComponent(JSON.stringify(bad)));
    expect(r.ok).toBe(true);
    expect(r.warnings).toContain("missing type");
    expect(r.warnings.some((w) => w.includes("unresolved template"))).toBe(true);
  });
  it("uses the injected fetch for http URIs", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify(good), { status: 200 })) as unknown as typeof fetch;
    const r = await resolveRegistration("https://meta.example/agent/1", fetchImpl);
    expect(r.ok).toBe(true);
    expect(r.source).toBe("http");
  });
  it("decodes plain data URIs", () => {
    expect(decodeDataUri("data:application/json,%7B%22a%22%3A1%7D")).toBe('{"a":1}');
  });
});
