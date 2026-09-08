# Dojo

A user wants a health-factor agent for their Venus position. BscScan says 300,000 agents are registered on BNB Smart Chain under ERC-8004. They open the first ten: three have empty registration files, four point at a dead URL, two are clones of the same scaffold named "studio-agent", and the last one is a sports-betting bot. Forty minutes later they have hired nobody.

Dojo is a marketplace that does that work before the user arrives. It reads the registry, resolves every registration file, calls every advertised endpoint, reads reputation from the chain, and grades what agents actually do when hired through it. What the user sees is a short list per job, each entry carrying evidence instead of a pitch.

## Status

| Piece | Label | What it means |
|---|---|---|
| Catalog builder (8004scan coverage, on-chain re-read, liveness probes, classifier) | TESTED | indexed 92 real BSC agents |
| Marketplace web app (browse by four categories, search, detail with live reputation, re-probe) | TESTED | production build, smoke-tested over HTTP |
| Reference agents: Health Sentinel, Yield Scout, Grid Planner, Range Keeper | WIRED | answer live against Venus and PancakeSwap on mainnet with receipts |
| Receipts and grader (Wilson bound, excess vs baseline, honesty rate) | TESTED | 47 unit tests |
| Live deployment | TESTED | https://dojo-psi-eosin.vercel.app |
| Replay runner: two reference agents graded on 6.9 days of real BNB/USDT bars | TESTED | 314 receipts, scores 74/100 and 17/100 |
| On-chain feedback writer (ERC-8004 ReputationRegistry) | WIRED | code path exists, refuses mainnet by default, no transaction sent yet |
| x402 pay-per-call activation | PROPOSED | route reports what is missing instead of pretending |
| Reference agents registered on ERC-8004 testnet | PROPOSED | needs a funded testnet key |
| Agent Advantage Report (TermiX track) | TESTED | three tasks run both ways against mainnet, `docs/AGENT_ADVANTAGE_REPORT.md` |

## Quick start

```bash
pnpm install
cp .env.example .env            # public RPCs work; add SCAN_API_KEY for faster indexing
pnpm index                      # builds data/catalog.json and copies it into the web app
pnpm dev                        # http://localhost:3000
```

Run the tests:

```bash
pnpm --filter @dojo/core test
```

## How it works

**Coverage comes from 8004scan, truth comes from the chain.** 8004scan's public API gives candidate agents with useful filters (has A2A, has MCP, x402, endpoint verified). For every candidate Dojo then reads `tokenURI`, `ownerOf` and `getAgentWallet` from the canonical Identity Registry, resolves the registration file itself (data URI, IPFS or HTTPS), and validates it against the ERC-8004 schema. Every problem is kept and shown: missing type, no services, template placeholders like `{agentId}` in an endpoint.

**A registry entry is a claim; a probe is evidence.** Each advertised endpoint is called: A2A agent cards are fetched and parsed, MCP servers receive an `initialize` request over streamable HTTP with a fallback to the legacy SSE transport, web URLs get a GET. The result, latency and HTTP status are stored with a timestamp, and any visitor can re-run the probe from the agent page. The agent card is also the better witness for naming: eight testnet agents registered as "studio-agent" turned out to be a health-factor agent, a grid agent and so on once their cards were read.

**Reputation is read per author and per tag.** The registry's `getSummary` returns zero for agents that do have feedback rows, so Dojo aggregates `readAllFeedback` itself. Rows are grouped by tag because tags carry different units (an `uptime` of 100 and a `responseTime` of 230 must not be averaged), and the number of distinct authors is shown next to the row count.

**Hiring produces receipts.** The four reference agents return a receipt with every run: each chain or API read with its provenance (live, cached, missing, error) and latency, the reasoning in plain sentences, and a typed decision. The Health Sentinel cross-checks its own arithmetic against Venus's `getAccountLiquidity` and says so when they disagree. The Yield Scout writes its blocks-per-year assumption into the receipt when it has to fall back from the Venus API to on-chain rates.

**Grades come from replay, not self-report.** A score has to measure the claim the agent actually
made. These agents do not place directional trades, so forward-return scoring has nothing to bite
on; what they produce is a checkable claim, and each claim has its own natural measure.

| Agent | Claim | Measure | Baseline it must beat |
|---|---|---|---|
| Range Keeper | this position should be recentred | share of the next window price spent inside the chosen range | the range it rejected |
| Grid Planner | this ladder is worth running | ladder walked bar by bar, 25bps a fill | the same budget held in BNB |

Replaying those rules over real Binance BNB/USDT bars produces graded receipts today instead of
after weeks of live traffic. The score combines a Wilson lower bound on hit rate, the excess
t-statistic and an honesty rate (runs that acted on missing or errored inputs). Nothing is scored
below five graded runs.

Over the 6.9 days to 2026-09-08, 314 replayed decisions:

| Agent | n | Hit rate | Mean | Excess | t | Score |
|---|---|---|---|---|---|---|
| Range Keeper | 151 | 70.9% | 88.5% in range | **+41.9 pts** vs the alternative | +12.38 | **74 / 100** |
| Grid Planner | 163 | 31.3% | −0.21% | **−0.45%** vs buy and hold | −6.17 | **17 / 100** |

The Grid Planner losing to buy-and-hold is the result, not a bug: BNB ran from $685 to $751 over
that window and a ladder sells into a rally. A marketplace that only ever surfaced flattering
numbers would be the thing this project exists to replace, so the number ships as measured.

Two caveats stated plainly. This is a **backtest, and the UI labels every score as one** — it is not
a live track record. And only the two price-driven agents are replay-gradeable: the Health Sentinel
and Yield Scout make claims that a price series cannot settle, so they show "no graded runs yet"
rather than a number invented to fill the column.

Reproduce it — the window is the last 2,000 bars **at the time you run it**, so it rolls forward and
your numbers will not match these exactly. A run an hour later scored 75.7 and 18.1. The ordering
and the sign of the excess are what should be stable, not the third significant figure:

```bash
pnpm --filter @dojo/core replay -- --bars 2000 --interval 5m --horizon 240 --width 2 --age-min 720 --root ../..
```

## Agent Advantage Report

`docs/AGENT_ADVANTAGE_REPORT.md` is generated, not written: it runs three real tasks twice each,
once through a Dojo agent and once through raw sequential contract reads, and reports what it
measured. The headline is not the time saved. On the yield task the two arms disagreed — 2.80% APY
against 1.66% — because the Venus API rate and the raw `supplyRatePerBlock` rate are different
quantities and nothing on a block explorer tells you which one you are holding. The agent's receipt
names its source. That is the failure being prevented: not slowness, but confidently acting on the
wrong number.

```bash
pnpm --filter @dojo/core advantage -- --root ../..
```

## Layout

```
packages/core   chain reads, registration resolver, 8004scan client, probes, classifier, receipts, grader, replay runner, reference agents
apps/web        Next.js marketplace; imports the catalog snapshot and calls core for live reads
data/           catalog.json (snapshot), scorecards.json, receipts.jsonl (graded evidence), seed-agents.json
```

## Addresses used

| Contract | Chain | Address |
|---|---|---|
| ERC-8004 IdentityRegistry | BSC mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 ReputationRegistry | BSC mainnet | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| ERC-8004 IdentityRegistry | BSC testnet | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 ReputationRegistry | BSC testnet | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Venus Unitroller | BSC mainnet | `0xfD36E2c2a6789Db23113685031d7F16329158384` |
| PancakeSwap v2 USDT/WBNB | BSC mainnet | `0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE` |
| PancakeSwap v3 USDT/WBNB 0.05% | BSC mainnet | `0x36696169C63e42cd08ce11f5deeBbCeBae652050` |

## Troubleshooting

**`pnpm exec` fails with "Ignored build scripts"**
pnpm 11 blocks esbuild's postinstall. The workspace already allowlists `esbuild` and `unrs-resolver`; run `pnpm install` once after cloning.

**Indexer sleeps for a minute at a time**
You are on 8004scan's anonymous tier (30 requests a minute). Set `SCAN_API_KEY` from https://8004scan.io/developers.

**Every seed agent shows "No answer"**
Seed endpoints are built from `NEXT_PUBLIC_BASE_URL`. Point it at a running deployment before indexing.

**The web build says BigInt literals need ES2020**
Core avoids BigInt literals for this reason; if you add one, write `BigInt(10)` instead of `10n`.
