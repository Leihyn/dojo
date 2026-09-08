/**
 * Register the four reference agents on the ERC-8004 Identity Registry.
 *
 * Testnet only, and enforced rather than documented: the chain is pinned to 97, mainnet is refused
 * outright, and nothing is sent until --execute is passed. A dry run is the default because a
 * registration is a permanent on-chain fact and a typo in the agentURI is not fixable by re-running.
 *
 * Usage:
 *   pnpm --filter @dojo/core register -- --root ../..              # dry run, sends nothing
 *   pnpm --filter @dojo/core register -- --root ../.. --execute    # sends the transactions
 */
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, http, formatEther, decodeEventLog, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainConfig } from "../chains";
import { identityRegistryAbi } from "../abi";
import { REF_AGENTS, registrationFile, type RefAgentName } from "../refagents";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); args.set(k, v ?? (process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[++i] ?? "true")); }
}
const root = path.resolve(process.cwd(), args.get("root") ?? "../..");
const execute = args.get("execute") === "true";
const CHAIN_ID = 97;

/** Minimal .env reader; the repo has no dotenv dependency and does not need one for a single script. */
async function loadEnv(file: string) {
  let txt = "";
  try { txt = await readFile(file, "utf8"); } catch { return; }
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[k]) process.env[k] = v;
  }
}
await loadEnv(path.join(root, ".env"));

const cfg = chainConfig(CHAIN_ID);
if (!cfg.testnet) throw new Error("refusing to run against a non-testnet chain");

const raw = (process.env.DEPLOYER_PRIVATE_KEY ?? "").trim();
if (!raw) {
  console.error(`
DEPLOYER_PRIVATE_KEY is empty in ${path.join(root, ".env")}.

Generate a fresh testnet-only key (do not reuse a key that exists in another project):

  cd packages/core && node -e "const{generatePrivateKey,privateKeyToAccount}=require('viem/accounts');const k=generatePrivateKey();console.log('DEPLOYER_PRIVATE_KEY='+k);console.log('address:',privateKeyToAccount(k).address)"

(run it from packages/core; viem is not resolvable from the repo root)

Put the line in .env, fund the address with tBNB from https://www.bnbchain.org/en/testnet-faucet,
then run this again.`);
  process.exit(1);
}
const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error(`DEPLOYER_PRIVATE_KEY is not a 32-byte hex key (got ${pk.length - 2} hex chars)`);

const account = privateKeyToAccount(pk);
const pub = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpcUrl) });
const wallet = createWalletClient({ account, chain: cfg.chain, transport: http(cfg.rpcUrl) });

// A key that holds mainnet value must not be used here even though this script only touches testnet:
// the address ends up in a public registry and in this repo's data files.
const mainnet = chainConfig(56);
const mainnetBalance = await createPublicClient({ chain: mainnet.chain, transport: http(mainnet.rpcUrl) })
  .getBalance({ address: account.address }).catch(() => BigInt(0));

const balance = await pub.getBalance({ address: account.address });
console.log(`Signer   ${account.address}`);
console.log(`Chain    ${cfg.name} (${CHAIN_ID})`);
console.log(`Balance  ${formatEther(balance)} tBNB`);
if (mainnetBalance > BigInt(0)) {
  console.error(`\nREFUSING: this address holds ${formatEther(mainnetBalance)} BNB on mainnet.`);
  console.error("Use a key that exists only for this testnet deployment.");
  process.exit(1);
}
// A dry run needs no gas; only refuse to execute unfunded.
if (balance === BigInt(0) && execute) {
  console.error(`\nNo tBNB. Fund ${account.address} at https://www.bnbchain.org/en/testnet-faucet and run again.`);
  process.exit(1);
}

const base = (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
if (base.includes("localhost")) throw new Error("NEXT_PUBLIC_BASE_URL points at localhost; the registry would record an unreachable agentURI");

const ledgerFile = path.resolve(root, "data", "registered-agents.json");
type Ledger = Record<string, { agentId: string; agentURI: string; txHash: string; registeredAt: string }>;
let ledger: Ledger = {};
try { ledger = JSON.parse(await readFile(ledgerFile, "utf8")) as Ledger; } catch { /* first run */ }

const names = Object.keys(REF_AGENTS) as RefAgentName[];
console.log(`Base URL ${base}`);
console.log(`Mode     ${execute ? "EXECUTE (transactions will be sent)" : "DRY RUN (nothing is sent; pass --execute)"}\n`);

for (const name of names) {
  const def = REF_AGENTS[name];
  const agentURI = `${base}/ref/${name}/registration.json`;

  if (ledger[name]) { console.log(`- ${name}: already registered as #${ledger[name].agentId}, skipping`); continue; }

  // The registry stores a pointer, so the pointer has to resolve before it is written.
  const res = await fetch(agentURI).catch(() => null);
  if (!res || !res.ok) { console.log(`- ${name}: SKIP, ${agentURI} did not resolve (${res ? res.status : "network error"})`); continue; }
  const body = await res.json().catch(() => null);
  const expected = registrationFile(def, base);
  if (!body || body.name !== expected.name) { console.log(`- ${name}: SKIP, registration file at ${agentURI} does not match the expected document`); continue; }

  const sim = await pub.simulateContract({ address: cfg.identityRegistry, abi: identityRegistryAbi, functionName: "register", args: [agentURI], account }).catch((e: Error) => e);
  if (sim instanceof Error) { console.log(`- ${name}: SKIP, simulation reverted: ${sim.message.split("\n")[0]}`); continue; }

  if (!execute) { console.log(`- ${name}: would register -> agentId ${String(sim.result)}, uri ${agentURI}`); continue; }

  const hash = await wallet.writeContract(sim.request);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  let agentId = String(sim.result);
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: identityRegistryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "Registered") { agentId = String((ev.args as { agentId: bigint }).agentId); break; }
    } catch { /* not our event */ }
  }
  ledger[name] = { agentId, agentURI, txHash: hash, registeredAt: new Date().toISOString() };
  await writeFile(ledgerFile, JSON.stringify(ledger, null, 2));
  console.log(`- ${name}: registered as #${agentId}  ${cfg.explorer}/tx/${hash}`);
}

if (execute && Object.keys(ledger).length) {
  // Point the seed entries at the real token ids so the catalog reads them from the chain.
  const seedFile = path.resolve(root, "data", "seed-agents.json");
  const seed = JSON.parse(await readFile(seedFile, "utf8")) as Array<{ tokenId: string; seedMeta?: { ref?: string } }>;
  let patched = 0;
  for (const s of seed) {
    const ref = s.seedMeta?.ref;
    if (ref && ledger[ref] && s.tokenId !== ledger[ref].agentId) { s.tokenId = ledger[ref].agentId; patched++; }
  }
  if (patched) { await writeFile(seedFile, JSON.stringify(seed, null, 2)); console.log(`\nPatched ${patched} seed entries with on-chain token ids; re-run \`pnpm index\` to pick them up.`); }
  console.log(`\nLedger: ${ledgerFile}`);
  console.log(`Env lines for .env:`);
  const envName: Record<string, string> = { "venus-health": "DOJO_REF_KEY_VENUS_HEALTH", "venus-yield": "DOJO_REF_KEY_VENUS_YIELD", "grid-planner": "DOJO_REF_KEY_GRID_PLANNER", "range-keeper": "DOJO_REF_KEY_RANGE_KEEPER" };
  for (const [ref, v] of Object.entries(ledger)) console.log(`  ${envName[ref]}=${CHAIN_ID}:${v.agentId}`);
}
