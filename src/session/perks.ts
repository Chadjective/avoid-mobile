/**
 * Pure helpers for Profile's "Your perks" battery meters. No React Native, no
 * fetch, no imports, so tests/perks.test.mjs runs them in Node.
 *
 * The numbers come from GET /api/me `usage` (web/src/lib/account-usage.ts),
 * counted server-side with the same functions the enforcement uses; nothing
 * here recomputes a limit. A missing `usage` (older server) means the meters
 * are hidden, see hasUsage.
 */

export type MeterBand = "ok" | "low" | "empty";

/** At or below this share of the limit left, the meter turns amber. */
export const LOW_FRACTION = 0.3;

export type MeterUsage = { used: number; limit: number; resets_at?: string | null };

export type PerksUsage = {
  scans: MeterUsage;
  requests: MeterUsage;
  follows: MeterUsage;
  queue_boost: number;
  tier_effective: string;
};

/** Remaining share, 0..1. A zero (or bad) limit reads as empty, never NaN. */
export function meterFraction(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  const left = (limit - Math.max(0, used)) / limit;
  return Math.min(1, Math.max(0, left));
}

/** Colour band: empty at 0, low at <= 30% left, ok above. */
export function meterBand(fraction: number): MeterBand {
  if (!(fraction > 0)) return "empty";
  return fraction <= LOW_FRACTION ? "low" : "ok";
}

/** How much of segment i (0-based) of n is filled, 0..1, for a left-to-right fill. */
export function segmentFills(fraction: number, n: number): number[] {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.min(1, Math.max(0, f * n - i)));
  return out;
}

/** "resets in 5h", "resets in 12m", "resets in 1d"; null when there is nothing to reset. */
export function resetsInText(resetsAt: string | null | undefined, now: number): string | null {
  if (!resetsAt) return null;
  const ms = Date.parse(resetsAt) - now;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "resets now";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `resets in ${minutes}m`;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 24) return `resets in ${Math.max(1, hours)}h`;
  return `resets in ${Math.round(ms / 86_400_000)}d`;
}

/** "7 of 10 left · resets in 5h"; the reset part is dropped when there is none. */
export function meterLabel(u: MeterUsage, now: number): string {
  const left = Math.max(0, u.limit - Math.max(0, u.used));
  const base = `${left} of ${u.limit} left`;
  const reset = u.used > 0 ? resetsInText(u.resets_at, now) : null;
  return reset ? `${base} · ${reset}` : base;
}

/** The meters need all three counters; anything less and Profile shows the tier text only. */
export function hasUsage(usage: unknown): usage is PerksUsage {
  if (!usage || typeof usage !== "object") return false;
  const u = usage as Record<string, unknown>;
  const ok = (m: unknown) => {
    if (!m || typeof m !== "object") return false;
    const r = m as Record<string, unknown>;
    return typeof r.used === "number" && typeof r.limit === "number";
  };
  return ok(u.scans) && ok(u.requests) && ok(u.follows);
}

export type PerkPerks = {
  follows: number;
  scansPerDay: number;
  requestsPerDay: number;
  queuePriority: number;
};

export type TierTableRow = { tier: string; cells: string[]; current: boolean };

/**
 * Member / Holder / Staker comparison. `perks` is SKR_PERKS (session/skr.ts);
 * `current` marks the effective tier (usage.tier_effective: member | holder |
 * staker, or the stored none | holder | staker).
 */
export function tierTable(
  perks: Record<"none" | "holder" | "staker", PerkPerks>,
  currentTier: string | null | undefined,
): { header: string[]; rows: TierTableRow[] } {
  const cur = currentTier === "member" || !currentTier ? "none" : currentTier;
  const defs: Array<["none" | "holder" | "staker", string]> = [
    ["none", "Member"],
    ["holder", "Holder"],
    ["staker", "Staker"],
  ];
  return {
    header: ["Scans/day", "Requests/day", "Follows", "Queue"],
    rows: defs.map(([key, label]) => {
      const p = perks[key];
      return {
        tier: label,
        cells: [String(p.scansPerDay), String(p.requestsPerDay), String(p.follows), `+${p.queuePriority}`],
        current: key === cur,
      };
    }),
  };
}
