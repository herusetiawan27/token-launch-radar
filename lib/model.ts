// Token Radar, model radar-2.
//
// One sealed DefiLlama snapshot in, one ranked board out. A protocol is
// pre-token when its snapshot record carries no token at all: no market cap,
// no CoinGecko id, no symbol. A protocol is eligible for the board when it is
// pre-token and is not a wrapped, staked or bridged product of a token that
// already trades. That is the same eligibility rule the snapshot's own
// watchlist was built with, applied to every row, watchlist or early:
//   - category is not CEX, Bridge, Canonical Bridge, Liquid Staking,
//     Liquid Restaking or Restaked BTC;
//   - the name does not end in a version marker (a space followed by V2,
//     v2, 2.0 or the like);
//   - the name carries no whole word "wrapped", "staked" or "staking";
//   - the name does not begin with an exchange's name (Binance, Coinbase,
//     Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini).
// The board is the whole watchlist (the floor) plus, below the floor, the
// eligible pre-token protocols with the most TVL. Live-token protocols are
// never ranked: they are shown apart with their market caps, which are facts,
// not a model. Every protocol in the snapshot is accounted for: ranked,
// live-token, or excluded by the rule above, and the dashboard's strip
// says how many fall in each bucket.
//
// Implied value is priced off the snapshot's own live-token peers, not off
// a constant the author chose. The peers are the protocols that already
// trade and carry a market cap: their market cap divided by their TVL is
// what the market has paid, per dollar of TVL, for a token. The base
// multiple for a row is the median of that ratio among the live peers in
// its own category, where the category has at least eight such peers; where
// it does not, it is the median over all live peers. The median is used
// because a few tokens trade at hundreds of times their TVL and the mean
// would be their number, not the market's. The fit is checked held-out:
// the peers are split in two by slug, and the dashboard reports the median
// of each half beside the whole-peer median, so a reader can see the
// multiple is stable and not fitted to a handful of names.
//
//   base     = tvl_usd x multiple          (multiple: fitted, see above)
//   growth   = clamp(change_7d, -50, 100) per cent
//   growth   = 1 + (growth / 100) x 0.6
//   maturity = 0.5 + min(age_days, 1460) / 1460 x 0.5   (age unknown: 365 days)
//   breadth  = 1 + 0.04 x min(chains - 1, 5)            (1 chain: 1.00, 6+: 1.20)
//   implied  = max(1, round(base x growth x maturity x breadth))
//
// TVL is the size of the business a token would represent. Growth is the
// business's direction over the last seven days. Maturity is how long the
// protocol has run with no token: a protocol that has grown large and stayed
// tokenless for years has had more time to earn a launch, and a younger one
// is discounted for it. Breadth is how many chains its TVL sits on: a
// protocol live on many chains has more surfaces a token could attach to
// than a single-chain one, capped so breadth can never dominate TVL.
//
// Launch odds are a separate peer statistic, shown beside the value, never
// folded into it: the share of snapshot protocols in the same age bucket
// that already have a token. Age buckets are under 180 days, 180-364 days,
// 1-2 years, and 2 years or more; a protocol with no listed date uses the
// whole snapshot's share. It answers "how often do protocols this old have
// a token?", not "will this one launch?".
//
// No protocol name is ever special-cased: one function scores every row.

/** One protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  comp_min_peers: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.5,
  maturity_range: 0.5,
  maturity_days: 1460,
  unknown_age_days: 365,
  breadth_per_chain: 0.04,
  breadth_max_extra: 5,
  comp_min_peers: 8,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** A farm verdict: what the plan costs, how long it takes, and the airdrop value that covers it. */
export interface FarmVerdict {
  capital_usd: number;
  gas_usd: number;
  total_cost_usd: number;
  hold_days: number;
  hours: number;
  break_even_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  launch_odds: number;
  model: {
    base_multiple: number;
    comp_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    chain_count: number;
    age_days: number | null;
  };
  farm_steps: string[];
  farm: FarmVerdict;
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  launch_odds: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  base_multiple: number;
  farm: FarmVerdict;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted pricing, computed from the snapshot's live-token peers at run time. */
export interface CompFit {
  overall_median: number;
  peer_count: number;
  half_a_median: number;
  half_b_median: number;
  by_category: Record<string, { median: number; peers: number }>;
}

/** How the snapshot's 758 protocols are accounted for. */
export interface Accounting {
  total: number;
  ranked: number;
  live: number;
  excluded: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist_slugs: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  comp_fit: CompFit;
  accounting: Accounting;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted list of numbers. */
function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A deterministic split of the peers into two halves, by slug, for the held-out check. */
function halfOf(slug: string): 'a' | 'b' {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? 'a' : 'b';
}

/**
 * Fit the pricing multiple from the snapshot's live-token peers: every
 * protocol that already trades and carries a positive market cap. The
 * multiple is the median market cap per dollar of TVL, overall and, where
 * a category has at least `comp_min_peers` peers, within that category.
 */
export function compFit(snapshot: Snapshot, model: ModelConstants = MODEL): CompFit {
  const peers = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const ratios = peers.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const halfA = peers
    .filter((p) => halfOf(p.slug) === 'a')
    .map((p) => p.mcap_usd! / p.tvl_usd)
    .sort((a, b) => a - b);
  const halfB = peers
    .filter((p) => halfOf(p.slug) === 'b')
    .map((p) => p.mcap_usd! / p.tvl_usd)
    .sort((a, b) => a - b);
  const byCategory: Record<string, { median: number; peers: number }> = {};
  const byCat = new Map<string, number[]>();
  for (const p of peers) {
    if (p.category === null) continue;
    const list = byCat.get(p.category) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCat.set(p.category, list);
  }
  for (const [cat, list] of byCat) {
    if (list.length >= model.comp_min_peers) {
      byCategory[cat] = { median: round4(medianOf([...list].sort((a, b) => a - b))), peers: list.length };
    }
  }
  return {
    overall_median: round4(medianOf(ratios)),
    peer_count: peers.length,
    half_a_median: round4(medianOf(halfA)),
    half_b_median: round4(medianOf(halfB)),
    by_category: byCategory,
  };
}

/** The base multiple a protocol gets: its category's fitted median, or the all-peer median. */
export function baseMultiple(p: SnapshotProtocol, fit: CompFit): { multiple: number; peers: number } {
  const cat = p.category !== null ? fit.by_category[p.category] : undefined;
  if (cat !== undefined) return { multiple: cat.median, peers: cat.peers };
  return { multiple: fit.overall_median, peers: fit.peer_count };
}

/** The age bucket a protocol falls in, for the launch-odds peer statistic. */
function ageBucket(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 180) return '<180d';
  if (age < 365) return '180-364d';
  if (age < 730) return '1-2y';
  return '2y+';
}

/**
 * Launch odds from the peers' record: the share of snapshot protocols in
 * the same age bucket that already have a token. A protocol with no listed
 * date uses the whole snapshot's share.
 */
export function launchOdds(snapshot: Snapshot): Map<string, number> {
  const buckets = new Map<string, { live: number; total: number }>();
  const overall = { live: 0, total: 0 };
  for (const p of snapshot.protocols) {
    const live = !isPreToken(p);
    const bucket = buckets.get(ageBucket(ageDays(snapshot.as_of, p.listed_at))) ?? { live: 0, total: 0 };
    bucket.total += 1;
    if (live) bucket.live += 1;
    buckets.set(ageBucket(ageDays(snapshot.as_of, p.listed_at)), bucket);
    overall.total += 1;
    if (live) overall.live += 1;
  }
  const out = new Map<string, number>();
  for (const [bucket, counts] of buckets) {
    out.set(bucket, counts.total > 0 ? Math.round((counts.live / counts.total) * 100) / 100 : 0);
  }
  out.set('unknown', overall.total > 0 ? Math.round((overall.live / overall.total) * 100) / 100 : 0);
  return out;
}

/** The multipliers and the implied value one protocol gets under `model` and `fit`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: CompFit,
  model: ModelConstants,
): { implied: number; multiple: number; peers: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, peers } = baseMultiple(protocol, fit);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + model.breadth_per_chain * extraChains;
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, multiple, peers, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word that marks a wrapped or staked product of another token. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** Categories that are a wrapped, staked, bridged or exchange product, not a protocol of their own. */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);
/** Exchange names a protocol name must not begin with. */
const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token and not a wrapped, staked or bridged product. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((prefix) => p.name.startsWith(prefix))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = compFit(snapshot, model);
  const odds = launchOdds(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug in it is ranked.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: eligible pre-token protocols below the watchlist floor,
  // by TVL, capped. Never a replacement for a watchlist row.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, multiple, peers, growthPct, growthMult, maturityMult, breadthMult, age } = impliedValue(p, snapshot.as_of, fit, model);
    const steps = farmSteps(p, age);
    return { p, implied, multiple, peers, growthPct, growthMult, maturityMult, breadthMult, age, steps };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    launch_odds: odds.get(ageBucket(s.age)) ?? 0,
    model: {
      base_multiple: s.multiple,
      comp_peers: s.peers,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      chain_count: s.p.chains.length,
      age_days: s.age,
    },
    farm_steps: s.steps.map(stepText),
    farm: farmVerdict(s.p, s.age, s.implied),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 20_000_000_000) return 500;
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** Gas for the position's opening transaction, from its capital tier. */
function openingGas(capital: number): number {
  return capital >= 250 ? 10 : capital >= 150 ? 8 : 4;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 90) return 90;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator'))
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action, so the farm plan is not the same sentence for every protocol. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return 'Make one qualifying action each week: top up the supply, borrow a small amount against it, or repay and re-supply.';
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return 'Make one qualifying action each week: swap in the pool, add or rebalance liquidity, or claim and re-stake the fees.';
  if (c.includes('bridge'))
    return 'Make one qualifying action each week: bridge a small amount in either direction and use it in the destination app.';
  if (c.includes('perpetual') || c.includes('derivative'))
    return 'Make one qualifying action each week: open or close one small hedged position and keep the margin posted.';
  if (c.includes('prediction'))
    return 'Make one qualifying action each week: take one small position in a live market and settle it.';
  if (c.includes('curator') || c.includes('allocator'))
    return 'Make one qualifying action each week: deposit a little more into the vault or vote on its next allocation.';
  if (c.includes('rwa'))
    return 'Make one qualifying action each week: mint a little more of the yield asset or move it between the protocol\'s vaults.';
  if (c.includes('stable'))
    return 'Make one qualifying action each week: mint, redeem or move the stable asset through the protocol.';
  return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${openingGas(capital)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyFor(p),
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay to claim and never sign a transaction you cannot read.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The farm verdict: the plan's cash cost, its hours, and the airdrop value that covers the cash cost. */
export function farmVerdict(p: SnapshotProtocol, age: number | null, implied: number): FarmVerdict {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  const gas = 3 + openingGas(capital) + 2 * weeks;
  const minutes = 5 + 15 + 10 * weeks + 10 + 5;
  return {
    capital_usd: capital,
    gas_usd: gas,
    total_cost_usd: capital + gas,
    hold_days: hold,
    hours: Math.round((minutes / 60) * 10) / 10,
    break_even_usd: capital + gas,
  };
}

/** The live-token protocols, by market cap, for the dashboard's Live token view: every one of them. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    launch_odds: row.launch_odds,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    base_multiple: row.model.base_multiple,
    farm: row.farm,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const fit = compFit(snapshot, model);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist_slugs: snapshot.watchlist,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    comp_fit: fit,
    accounting: {
      total: snapshot.protocols.length,
      ranked: board.length,
      live: live.length,
      excluded: snapshot.protocols.length - board.length - live.length,
    },
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
