/**
 * A receipt is the unit of evidence behind every performance number on the marketplace.
 * It records what the agent looked at (with provenance), what it decided, and what happened.
 */
import { z } from "zod";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export const provenanceSchema = z.enum(["live", "cached", "missing", "error"]);

export const toolCallSchema = z.object({
  tool: z.string(),
  args: z.record(z.unknown()).default({}),
  provenance: provenanceSchema,
  latencyMs: z.number().nonnegative().optional(),
  source: z.string().optional(),
  note: z.string().optional(),
});

export const decisionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("practice_trade"),
    symbol: z.string(),
    side: z.enum(["long", "short"]),
    sizeUsd: z.number().positive(),
    entryPrice: z.number().positive(),
    horizonMin: z.number().int().positive(),
    thesis: z.string(),
  }),
  z.object({ kind: z.literal("alert"), severity: z.enum(["info", "warning", "critical"]), message: z.string(), subject: z.string().optional() }),
  z.object({ kind: z.literal("report"), summary: z.string(), artifactUrl: z.string().optional() }),
  z.object({ kind: z.literal("noop"), reason: z.string() }),
]);

export const outcomeSchema = z.object({
  evaluatedAt: z.string(),
  /** Minutes between the decision and the measurement. Lets the grader bucket resolved receipts. */
  horizonMin: z.number().int().positive().optional(),
  /** What returnPct measures when it is not a price return, e.g. "time-in-range" or "grid-pnl". */
  metric: z.string().optional(),
  exitPrice: z.number().positive().optional(),
  returnPct: z.number().optional(),
  baselineMeanPct: z.number().optional(),
  excessPct: z.number().optional(),
  correct: z.boolean().optional(),
  note: z.string().optional(),
});

export const receiptSchema = z.object({
  id: z.string(),
  agentKey: z.string(),
  agentName: z.string().optional(),
  category: z.string(),
  task: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  inputs: z.array(toolCallSchema),
  reasoning: z.array(z.string()),
  decision: decisionSchema,
  outcome: outcomeSchema.optional(),
  cost: z.object({ usd: z.number().nonnegative().default(0), wallMs: z.number().nonnegative() }),
  txHash: z.string().optional(),
});

export type Receipt = z.infer<typeof receiptSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type Decision = z.infer<typeof decisionSchema>;

export class ReceiptStore {
  constructor(private readonly file: string) {}

  async append(r: Receipt): Promise<void> {
    receiptSchema.parse(r);
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, JSON.stringify(r) + "\n");
  }

  async readAll(): Promise<Receipt[]> {
    try {
      const raw = await readFile(this.file, "utf8");
      return raw.split("\n").filter(Boolean).map((l) => receiptSchema.parse(JSON.parse(l)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
}

export function newReceiptId(agentKey: string, startedAt: string): string {
  return `${agentKey.replace(/[^a-z0-9]/gi, "-")}-${startedAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
}
