# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/herusetiawan27/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/herusetiawan27/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: 178 pre-token protocols ranked by implied launch value, priced off the live-token peers in a sealed DefiLlama snapshot, with a sortable dashboard, per-protocol detail views and costed farm plans. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

That reads the snapshot, scores every protocol, and writes `out/board.json`, `out/data.js`, `out/dashboard/` and `out/dossier.json`. Node 22 or later, standard library only, no network.

## How the ranking works

The model is `radar-2`, in `lib/model.ts`, and the dashboard recomputes it in the page so the numbers it shows are the numbers `board.json` carries.

- **Who ranks.** A protocol is pre-token when its snapshot record carries no market cap, no CoinGecko id and no symbol. The board is the whole 40-protocol watchlist (the $50M TVL floor) plus the eligible pre-token protocols below that floor, by TVL. A protocol is left out when it is a wrapped, staked or bridged product of a token that already trades, an exchange, or a versioned pool. Live-token protocols are never ranked; they are shown apart with their market caps, which are facts, not a model.
- **Implied value.** `implied = round(TVL × multiple × growth × maturity × breadth)`. The multiple is fitted, not chosen: the median market cap per dollar of TVL among the live-token peers that carry a market cap (x0.21 overall on 128 peers), using the category median where a category has at least eight such peers. Growth is the seven-day change, clamped to −50…+100% and weighted 0.6. Maturity is how long the protocol has run with no token, from 0.5 at listing to 1.0 after four years. Breadth is 1 + 0.04 per extra chain, capped at 1.20.
- **Launch odds.** A separate peer statistic shown beside the value, never folded into it: the share of protocols in the same age bucket that already have a token.
- **Farm plans.** Six steps per protocol, derived from its category, chains, TVL and age, each with a cost and a time, plus a verdict that nets the plan to the dollar: capital plus gas, over the hold, and the airdrop value that breaks even on the cash cost.

## What is in this repo

- `main.ts` — the entry program: reads the snapshot, builds the board, writes `board.json`, `data.js`, `dashboard/` and `dossier.json`.
- `lib/model.ts` — the ranking model, the eligibility rule, the farm plans and the live-token view.
- `dashboard/` — the dashboard: `index.html`, `app.css`, `app.js`. Static files, no network, no fetch; it reads `data.js`.
- `vendor/makefun-board.ts` — the house board library, copied from the kit as its header instructs.
- `screenshots/` — three screenshots of the dashboard: the board, a protocol detail view, and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=2vvp02vv&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

---
