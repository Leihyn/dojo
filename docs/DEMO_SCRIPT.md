# Dojo — demo script

Target: 2 minutes 30. One browser window, one terminal. No slides.

## Before recording

- [ ] `https://dojo-psi-eosin.vercel.app` open, logged out, cache warm (click through every page once first — cold serverless reads add two seconds)
- [ ] Second tab on `https://bscscan.com/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — the live registry count is the hook
- [ ] Terminal in `~/Desktop/dev/dojo`, font at 18pt, ready to run the replay command
- [ ] Zoom the browser to 110%; the scorecard table is the smallest thing on screen and it has to be readable
- [ ] Close Slack, Notifications off

## The hook (0:00 – 0:20)

**[Do: BscScan tab, scroll to the holder/token count]**

> "Three hundred and ten thousand agents are registered on BNB Smart Chain under ERC-8004.
>  Say you want one thing: something that watches your Venus position and tells you before you get
>  liquidated. So you start opening them."

**[Do: click three registry entries fast — an empty registration, a dead URL, a "studio-agent"]**

> "Empty registration file. Dead endpoint. And this one is called 'studio-agent' — so are seven
>  others. Forty minutes in, you have hired nobody. The registry tells you an agent exists.
>  It does not tell you whether it works."

## The turn (0:20 – 0:35)

**[Do: open dojo-psi-eosin.vercel.app]**

> "Dojo does that work before you arrive. It reads the registry, resolves every registration file,
>  calls every endpoint the agent advertises, reads its reputation off-chain — sorry, off the chain —
>  and grades what it actually does. Four jobs, equal billing."

**[Do: hover the four category tiles]**

## Find and understand (0:35 – 1:20)

**[Do: click Health Factor Monitoring]**

> "Eleven agents claim they monitor health factors. Dojo already called all of them."

**[Do: point at the Live / No answer badges]**

> "This is not a self-reported uptime badge. Dojo sent an A2A request and an MCP initialize to each
>  one and kept the result and the latency."

**[Do: open Dojo Health Sentinel detail page]**

> "Registration warnings, endpoint probes with timestamps, on-chain reputation read live — per tag
>  and per author, because an uptime of 100 and a response time of 230 must never be averaged into
>  one number."

## The money shot (1:20 – 2:05)

**This is the part that lands. Do not rush it.**

**[Do: open Dojo Range Keeper, scroll to Graded performance]**

> "And this is the number the registry can never give you. Seventy-four out of a hundred. A hundred
>  and fifty-one decisions replayed over seven days of real BNB/USDT bars. When this agent said
>  recentre, the price stayed inside the range it picked eighty-eight percent of the next four hours,
>  forty-two points better than leaving the position alone. T-statistic of twelve."

**[Do: now open Dojo Grid Planner — same section]**

> "And here is the one we built ourselves, scoring seventeen out of a hundred."

**[Beat. Let it sit.]**

> "Its ladder lost to simply holding BNB, by nearly half a percent a run, across a hundred and
>  sixty-three runs. BNB rallied that week and a grid sells into a rally. We are not hiding that.
>  A marketplace that only ever shows you flattering numbers is the thing we are trying to replace."

**[Do: point at the amber "Replay-graded, not a live track record" banner]**

> "And every score says exactly how it was measured."

## Activate (2:05 – 2:25)

**[Do: click Try / Run on the Health Sentinel, submit empty input]**

> "Hiring produces a receipt. It picked a real borrower off recent Venus logs, read five markets on
>  mainnet, computed the health factor, and cross-checked its own arithmetic against Venus's own
>  getAccountLiquidity — and it tells you when those two disagree. Every read tagged live. Half a
>  second."

## Close (2:25 – 2:40)

> "Registry entries are claims. Probes, receipts and replay are evidence. Dojo ranks three hundred
>  thousand agents by the second one."

**[Do: terminal, run:]**

```
pnpm --filter @dojo/core replay -- --bars 2000 --interval 5m --horizon 240 --width 2 --age-min 720 --root ../..
```

> "And you can reproduce every number in this demo with one command."

## If things go wrong

**The live BSC read hangs on the Try page** — public dataseed nodes rate-limit. Cut to the receipt
already on screen from the warm-up pass; the numbers are identical.

**A category page shows fewer agents than you said** — say the count you see, not the count in the
script. The catalog is rebuilt from a live registry and moves between runs.

**Vercel cold start** — the first request after a quiet minute takes ~2s. Click every page once
before you hit record.
