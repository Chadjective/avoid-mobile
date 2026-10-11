/**
 * The wording of Profile's SKR line: tier, perks and the next step. Pure (no
 * React Native, no fetch) so tests/skr.test.mjs runs it in Node.
 *
 * SOURCE OF TRUTH: web/src/lib/entitlements.ts TIER_TABLE (perks) and
 * web/src/lib/seeker.ts (holder = liquid + staked >= 69 SKR, staker = staked
 * >= 420 SKR). The numbers below are a copy; change them there first. Staker
 * perks only apply inside the launch window (SKR_STAKER_WINDOW_START on the
 * server) and until then a staker gets holder perks, which the stored tier
 * does not show, so the staker line says what the tier is entitled to.
 */
export type SkrTierName = "none" | "holder" | "staker";

export const SKR_HOLDER_MIN = 69;
export const SKR_STAKER_MIN = 420;

export type SkrPerks = {
  follows: number;
  scansPerDay: number;
  requestsPerDay: number;
  queuePriority: number;
};

/** Member (no SKR) and the two SKR tiers. Mirrors TIER_TABLE. */
export const SKR_PERKS: Record<SkrTierName, SkrPerks> = {
  none: { follows: 10, scansPerDay: 10, requestsPerDay: 10, queuePriority: 0 },
  holder: { follows: 50, scansPerDay: 30, requestsPerDay: 15, queuePriority: 1 },
  staker: { follows: 200, scansPerDay: 50, requestsPerDay: 25, queuePriority: 2 },
};

export function normalizeSkrTier(tier: string | null | undefined): SkrTierName {
  return tier === "holder" || tier === "staker" ? tier : "none";
}

const TIER_LABEL: Record<SkrTierName, string> = {
  none: "Member",
  holder: "Holder",
  staker: "Staker",
};

/** Whole SKR, rounded down, with thousands separators: 1234.9 -> "1,234". */
export function formatSkrAmount(n: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export type SkrLine = {
  /** "182 SKR · Holder", or just "Holder" when the server sent no amounts. */
  title: string;
  /** "50 follows · 30 scans a day · queue priority +1". */
  perks: string;
  /** The next step, or the staker perks in full. */
  next: string;
};

export function skrLine(
  tierValue: string | null | undefined,
  liquid?: number | null,
  staked?: number | null,
): SkrLine {
  const tier = normalizeSkrTier(tierValue);
  const label = TIER_LABEL[tier];
  const haveAmounts = typeof liquid === "number" || typeof staked === "number";
  const total = (typeof liquid === "number" ? liquid : 0) + (typeof staked === "number" ? staked : 0);
  const p = SKR_PERKS[tier];

  let next: string;
  if (tier === "none") next = `Hold ${SKR_HOLDER_MIN} SKR to become a Holder`;
  else if (tier === "holder") next = `Stake ${SKR_STAKER_MIN} SKR to become a Staker`;
  else {
    next = `Staker perks: ${p.follows} follows · ${p.scansPerDay} scans a day · ${p.requestsPerDay} requests a day · queue priority +${p.queuePriority}`;
  }

  return {
    title: haveAmounts ? `${formatSkrAmount(total)} SKR · ${label}` : label,
    perks: `${p.follows} follows · ${p.scansPerDay} scans a day · queue priority +${p.queuePriority}`,
    next,
  };
}
