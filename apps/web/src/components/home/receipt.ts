/**
 * A real Range Keeper receipt from a live run on 2026-10-30T22:32Z (abridged to the fields shown).
 * Kept verbatim so the page never shows a paraphrase or a placeholder hash.
 */
export const SAMPLE_RECEIPT = {
  agent: "range-keeper",
  startedAt: "2026-10-30T22:32:05.421Z",
  label: "Sample run, 2026-10-30 22:32 UTC",
  input: { tool: "pancake.v3.slot0", provenance: "live", latencyMs: 102 },
  reasoning: "Pool tick -65497 ($698.78 per BNB); position [-66800, -64800) is in range, 7.22% from the nearest edge.",
  decision: { kind: "report", summary: "in range, hold" },
  receiptHash: "0x2bf2d6928c7e6ac309c69774970d30177a36fa437ee375e4234a4dc80541cbaf",
} as const;
