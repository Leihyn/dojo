import path from "node:path";
import { buildCatalog, writeCatalog } from "../catalog";
import { ScanClient } from "../scan";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); args.set(k, v ?? process.argv[++i] ?? "true"); }
}
const root = path.resolve(process.cwd(), args.get("root") ?? "../..");
const chainIds = (args.get("chains") ?? "56,97").split(",").map(Number);
const perFilter = Number(args.get("per-filter") ?? 25);
const out = path.resolve(root, args.get("out") ?? "data/catalog.json");

const scan = new ScanClient({ apiKey: process.env.SCAN_API_KEY || undefined, cacheDir: path.join(root, "data", "cache") });
const t0 = Date.now();
const catalog = await buildCatalog({ chainIds, perFilter, scan, seedFile: path.join(root, "data", "seed-agents.json"), log: (s) => console.log(s) });
await writeCatalog(catalog, out);
for (const extra of (args.get("copy-to") ?? "apps/web/src/data/catalog.json").split(",").filter(Boolean)) { const { copyFile, mkdir } = await import("node:fs/promises"); const dest = path.resolve(root, extra); await mkdir(path.dirname(dest), { recursive: true }); await copyFile(out, dest); }
const q = catalog.quality;
console.log(`\nWrote ${catalog.entries.length} entries to ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(`registration ok ${q.registrationOk} / failed ${q.registrationFailed}; live ${q.live}, gated ${q.gated}, dead ${q.dead}, unresolved ${q.unresolved}`);
console.log(`categories: ${Object.entries(q.byCategory).map(([k, v]) => `${k}=${v}`).join(" ")}`);
