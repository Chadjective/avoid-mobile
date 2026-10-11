/**
 * Pure helpers behind Profile's requests-first top section. No imports from
 * React Native or the network, so tests/profile-requests.test.mjs runs under
 * plain Node.
 */

export type RequestRow = {
  id: string;
  entity: string;
  status: string;
  slug: string | null;
  created_at: string;
  /** Optional list-route extras (older servers omit them). */
  page_trust_score?: number | null;
  page_entity_name?: string | null;
  published_at?: string | null;
  queue_position?: number | null;
};

/** The name a row shows: the page's entity name when known, else the request's. */
export function rowDisplayName(r: Pick<RequestRow, "entity" | "page_entity_name">): string {
  const n = r.page_entity_name?.trim();
  return n ? n : r.entity;
}

/** A finite page score, or null (then the PUBLISHED pill is the fallback). */
export function rowScore(r: Pick<RequestRow, "page_trust_score">): number | null {
  const s = r.page_trust_score;
  return typeof s === "number" && Number.isFinite(s) ? s : null;
}

/** Second line of a published row: "published 2 days ago" or, lacking it, "requested …". */
export function publishedSubline(
  r: Pick<RequestRow, "published_at">,
  publishedAgo: string,
  requestedAgo: string,
): string {
  if (r.published_at && publishedAgo) return `published ${publishedAgo}`;
  return requestedAgo ? `requested ${requestedAgo}` : "requested";
}

export type RequestGroups = {
  /** queued + running, newest first. */
  queue: RequestRow[];
  /** fulfilled with a page to open, newest first. */
  published: RequestRow[];
  /** failed / rejected / anything else that ended without a page, newest first. */
  other: RequestRow[];
};

function when(r: RequestRow): number {
  return Date.parse(r.created_at) || 0;
}

/** Split the account's requests into the three Profile lists, each newest first. */
export function groupRequests(rows: RequestRow[]): RequestGroups {
  const sorted = [...rows].sort((a, b) => when(b) - when(a));
  const queue: RequestRow[] = [];
  const published: RequestRow[] = [];
  const other: RequestRow[] = [];
  for (const r of sorted) {
    if (r.status === "queued" || r.status === "running") queue.push(r);
    else if (r.status === "fulfilled" && r.slug) published.push(r);
    else other.push(r);
  }
  return { queue, published, other };
}

/** How many rows a collapsed list shows. */
export const COLLAPSED_ROWS = 3;

/** The visible slice and the "+ N more" count for a list. */
export function collapse<T>(items: T[], expanded: boolean, limit = COLLAPSED_ROWS): { shown: T[]; more: number } {
  if (expanded || items.length <= limit) return { shown: items, more: 0 };
  return { shown: items.slice(0, limit), more: items.length - limit };
}

/** "+ 4 more · See all →" */
export function moreLabel(more: number): string {
  return `+ ${more} more · See all →`;
}

/** 14:05 UTC from a Date, zero padded. */
export function formatUtcTime(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

/**
 * The second line of a queue row. With a queue position (list route or
 * GET /api/requests/:id) a queued row reads "#N in line · requested …";
 * without one it says it is waiting for the next run, and a running one says
 * it is being researched.
 */
export function queueSubline(row: { status: string }, requestedAgo: string, position?: number | null): string {
  const base = requestedAgo ? `requested ${requestedAgo}` : "requested";
  if (row.status === "running") return `${base} · being researched now`;
  if (typeof position === "number" && Number.isInteger(position) && position >= 1) {
    return `#${position} in line · ${base}`;
  }
  return `${base} · in the next run`;
}

/**
 * Which published requests are NEW: fulfilled and not yet in the set of ones
 * this phone has acknowledged (opened). `published_at` is deliberately NOT
 * compared with a last-visit time: Profile stores no visit timestamp, the
 * seen-id set already means "published since you last looked" (the first visit
 * seeds a baseline), and it survives clock skew and an absent published_at. `seen === null` means the first ever Profile visit: nothing
 * is NEW, and the whole current set should be stored as the baseline.
 */
export function newPublished(
  publishedIds: string[],
  seen: string[] | null,
): { newIds: Set<string>; baseline: string[] | null } {
  if (seen === null) return { newIds: new Set(), baseline: [...publishedIds] };
  const known = new Set(seen);
  return { newIds: new Set(publishedIds.filter((id) => !known.has(id))), baseline: null };
}

/** The seen-set after opening one request (capped so storage stays small). */
export function markSeen(seen: string[] | null, id: string, cap = 200): string[] {
  const next = (seen ?? []).filter((x) => x !== id);
  next.push(id);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Alerts newer than the stored last-visit time; all of them when never visited. */
export function unreadAlertCount(alerts: Array<{ created_at: string }>, lastVisit: string | null): number {
  if (!lastVisit) return alerts.length;
  const since = Date.parse(lastVisit);
  if (Number.isNaN(since)) return alerts.length;
  return alerts.filter((a) => (Date.parse(a.created_at) || 0) > since).length;
}

/** Evidence count for the strip: the larger of the recent list and the server tally. */
export function evidenceCount(
  submissions: unknown[] | undefined,
  rep: { acceptedCount: number; rejectedCount: number } | null | undefined,
): number {
  const tally = (rep?.acceptedCount ?? 0) + (rep?.rejectedCount ?? 0);
  return Math.max(submissions?.length ?? 0, tally);
}

// ---------------------------------------------------------------------------
// Request screen: the "boost your rank" copy, from the SKR constants.
// ---------------------------------------------------------------------------

export type BoostInput = {
  tier: "none" | "holder" | "staker";
  holderMin: number;
  stakerMin: number;
  perks: Record<"none" | "holder" | "staker", { queuePriority: number }>;
};

export type BoostCopy =
  | { kind: "card"; heading: string; lines: string[] }
  | { kind: "applied"; applied: string; next: string | null };

/** What a signed-in requester sees on the status screen about queue priority. */
export function boostCopy(i: BoostInput): BoostCopy {
  const p = i.perks;
  if (i.tier === "none") {
    return {
      kind: "card",
      heading: "Boost your rank",
      lines: [
        `Hold ${i.holderMin} SKR: queue priority +${p.holder.queuePriority}`,
        `Stake ${i.stakerMin} SKR: queue priority +${p.staker.queuePriority}`,
      ],
    };
  }
  if (i.tier === "holder") {
    return {
      kind: "applied",
      applied: `Queue priority +${p.holder.queuePriority} applied (SKR holder).`,
      next: `Stake ${i.stakerMin} SKR to move up one more (+${p.staker.queuePriority}).`,
    };
  }
  return {
    kind: "applied",
    applied: `Queue priority +${p.staker.queuePriority} applied (SKR staker).`,
    next: null,
  };
}
