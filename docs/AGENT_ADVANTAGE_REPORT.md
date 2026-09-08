# Agent Advantage Report

Three tasks a BNB Chain user actually has, each done twice: once by hiring a Dojo reference
agent, once the way it gets done without one, opening the contract on BscScan and reading it
function by function.

**What is measured and what is assumed.** Wall time and the number of distinct contract reads
are measured on both arms, on BNB Smart Chain mainnet, in the same run. Human time is not
measured: it is calculated at **45s per lookup** (find the function, paste the argument, read the
raw integer, write it down) plus **4 minutes** for the unscaling and arithmetic that follows. Both
constants are inputs to the script, so substitute your own and the table recomputes.

Run: `2026-09-08T19:41:36.619Z` · RPC `bsc-dataseed.binance.org`

## Summary

| Task | Agent wall | Manual wall | Agent reads | Manual reads | Manual human time | Independent check |
|---|---|---|---|---|---|---|
| T1 Is this Venus position close to liquidation? | 1.9s | 2.3s | 4 | 14 | ~15 min | yes (agent only) |
| T2 Best stablecoin supply yield on Venus | 1.0s | 3.5s | 1 | 10 | ~12 min | neither |
| T3 Is this PancakeSwap v3 position still in range? | 599ms | 181ms | 1 | 1 | ~5 min | neither |

## What the numbers actually say

**Wall-clock time is the least interesting column.** Both arms talk to the same RPC and the
machine difference is small. The gap that matters is the third and fourth columns: the number of
separate things a person has to look up, in the right order, before any arithmetic starts.

**The advantage is not uniform, and one task barely has one.** T3 needs a single `slot0` read; an
agent saves almost no fetching there. Its contribution is the tick-to-price conversion, the
inverted quote order, and snapping the suggested range to tick spacing so the mint does not
revert. T1 is the opposite: the reads themselves are the work, and they scale with the number of
markets the account has entered.

**The two arms disagreed on T2, and that is the whole argument.** The agent answered
**2.92% APY** and the manual path answered **1.73% APY**, a 69% gap on the
number the user is about to move money on. Neither is a bug:
the Venus API rate and the raw supplyRatePerBlock rate are different quantities: the on-chain rate is the base supply rate only, and multiplying it by an assumed blocks-per-year is a second source of drift. Both are defensible; they are not the same question.

A person reading one figure off BscScan has no way to know which of the two they are holding,
because the screen does not say. The agent's receipt names its source, and that is worth more
than the minutes saved: the failure being prevented is not slowness, it is confidently acting
on the wrong number.

**Only one arm checks itself.** In T1 the agent recomputes the position from the markets and then
compares its own answer with the protocol's `getAccountLiquidity`, and reports the disagreement
when there is one. The manual path produces a number with nothing to test it against, which is
the failure mode that matters, because a wrong health factor looks exactly like a right one.

## Task detail

### T1: Is this Venus position close to liquidation?

*risk / security*. Account 0xD7E004CBda24E079aA3A657Ba7f8E2915192a966: health factor, and how far collateral can fall before shortfall.

**With the agent.** 1.9s, 4 reads, receipt `seed-venus-health-20260908194127`

> health factor 1.426, 29.9% drawdown to shortfall, status healthy

- cross-checked against the protocol's own getAccountLiquidity, agreeing within 0.00%

**Without.** 2.3s of RPC, 14 reads, ~15 minutes of human time

> health factor 1425795797831154688.000 (no independent check)

- 3 markets, each needing getAccountSnapshot, symbol, markets() and getUnderlyingPrice
- exchange rate, collateral factor and price are all 18-decimal mantissas that have to be unscaled by hand
- nothing in this path tells you whether the arithmetic is right

### T2: Best stablecoin supply yield on Venus

*yield*. Where should $10,000 of stablecoins sit on Venus core pool today?

**With the agent.** 1.0s, 1 read, receipt `seed-venus-yield-20260908194131`

> vFDUSD at 2.92% APY (source: venus-api)

- falls back from the Venus API to on-chain rates and writes the blocks-per-year assumption into the receipt when it does
- excludes markets whose oracle price is stale or zero

**Without.** 3.5s of RPC, 10 reads, ~12 minutes of human time

> vFDUSD at 1.73% APY

- blocks-per-year is a hardcoded constant (42,048,000); get it wrong and every APY on the page is wrong
- supplyRatePerBlock excludes XVS incentives, so this understates the real rate and nothing warns you
- you have to know which vTokens are the stablecoin markets before you start

### T3: Is this PancakeSwap v3 position still in range?

*trading / LP*. Position [-66800, -64800) on the BNB/USDT 0.05% pool: in range, and if not, where should it move?

**With the agent.** 599ms, 1 read, receipt `seed-range-keeper-20260908194135`

> in range, 6.22% from the edge, action: hold

- the suggested range is snapped to the pool's tick spacing, so it is actually mintable
- graded: 74/100 over 151 replayed decisions

**Without.** 181ms of RPC, 1 read, ~5 minutes of human time

> tick -66197, in range (no suggested range)

- one cheap read, but the answer stops at a signed integer
- converting tick to a price means 1.0001^tick by hand, and the pool quotes token1/token0 so it reads inverted
- a recentred range still has to be snapped to tick spacing or the mint reverts

## Reproducing this

```bash
pnpm --filter @dojo/core advantage -- --root ../..
```

The script runs both arms against mainnet in the same process. The manual arm issues raw
sequential `readContract` calls and does not import the agent's helper modules, because those
helpers are exactly what is being valued.
