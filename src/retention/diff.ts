/**
 * "What changed since you last looked" — the comparisons behind three of the
 * retention loops (docs/RETENTION_LOOPS_SPEC.md §4):
 *
 *   Loop 3  since your last visit   → pageChanges(), homeChanges()
 *   Loop 2  what moved on follows   → watchMoves()
 *   Loop 6  wallet re-scan diff     → scanDiff()
 *
 * Every input is either data the app already fetched from a public, CDN-cached
 * route, or a snapshot this phone wrote itself (src/retention/memory.ts). No
 * function here causes a request, and the server never learns what anyone
 * looked at — "last seen" lives on the device (CLAUDE.md cost rules; spec §3).
 *
 * PURE and import-free on purpose, so the logic can be exercised under plain
 * Node without Metro or React Native. Band labels are NOT computed here — the
 * UI bands a score with src/design/bands.ts, so a rename of a band there
 * (another session is renaming VERIFIED → "LOW RISK") needs no change here.
 *
 * GUARDRAILS (spec §7) this file enforces by construction: a change is only
 * ever reported when the record really changed — a score that differs, or a
 * decision event with a timestamp after the marker. Nothing is inferred,
 * nothing is invented, and a first visit (no marker) reports nothing rather
 * than calling everything "new".
 */

// ---------------------------------------------------------------------------
// Shared shapes (structural, so the API types satisfy them without imports)
// ---------------------------------------------------------------------------

/** The slice of a decision event every comparison needs. */
export type DecisionLike = {
  id: string;
  decision: string;
  created_at: string;
  prev_score?: number | null;
  new_score?: number | null;
};

/** A feed event: a decision that also names its page. */
export type ActivityLike = DecisionLike & { slug: string; entity_name: string };

export type ScoreMove = { from: number; to: number };

/** Decision verbs, grouped the way a reader thinks about them. */
export type DecisionKind = "evidence" | "review" | "other";

export function decisionKind(decision: string): DecisionKind {
  if (decision === "accept") return "evidence";
  if (decision.startsWith("review")) return "review";
  return "other";
}

function after(iso: string, marker: string): boolean {
  const a = Date.parse(iso);
  const b = Date.parse(marker);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a > b;
}

function scoreMove(from: number | null | undefined, to: number | null | undefined): ScoreMove | null {
  if (typeof from !== "number" || typeof to !== "number") return null;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  // Scores are shown rounded; a move that rounds to nothing is not a move.
  if (Math.round(from) === Math.round(to)) return null;
  return { from: Math.round(from), to: Math.round(to) };
}

// ---------------------------------------------------------------------------
// Loop 3 — one page
// ---------------------------------------------------------------------------

/** What this phone remembers about a page the last time it was opened. */
export type PageSnapshot = {
  slug: string;
  entity_name: string;
  score: number | null;
  updated_at: string;
  seenAt: string;
};

export type PageChanges = {
  /** When the reader last opened this page. */
  since: string;
  score: ScoreMove | null;
  /** Accepted evidence decided after `since`. */
  newEvidence: number;
  /** Fact-check (review_*) verdicts after `since`. */
  newReviews: number;
  /** Any other decision after `since` (rejections, revocations, …). */
  otherDecisions: number;
  /** Ids of every decision after `since`, so the audit trail can mark them. */
  newDecisionIds: string[];
  /** The page itself was rewritten (updated_at moved) after `since`. */
  pageUpdated: boolean;
};

/**
 * Null when there is nothing to compare against (first visit) or nothing
 * changed. A non-null result always has at least one real change in it.
 */
export function pageChanges(
  previous: PageSnapshot | null,
  current: { score: number | null; updated_at: string },
  events: ReadonlyArray<DecisionLike>,
): PageChanges | null {
  if (!previous) return null;
  const fresh = events.filter((e) => after(e.created_at, previous.seenAt));
  const result: PageChanges = {
    since: previous.seenAt,
    score: scoreMove(previous.score, current.score),
    newEvidence: fresh.filter((e) => decisionKind(e.decision) === "evidence").length,
    newReviews: fresh.filter((e) => decisionKind(e.decision) === "review").length,
    otherDecisions: fresh.filter((e) => decisionKind(e.decision) === "other").length,
    newDecisionIds: fresh.map((e) => e.id),
    pageUpdated: after(current.updated_at, previous.updated_at),
  };
  const any =
    result.score !== null || result.newDecisionIds.length > 0 || result.pageUpdated;
  return any ? result : null;
}

// ---------------------------------------------------------------------------
// Loop 3 — the home feed
// ---------------------------------------------------------------------------

export type YourPageMove = {
  slug: string;
  entity_name: string;
  score: ScoreMove | null;
  decisions: number;
  latestAt: string;
};

/** A page published or rewritten after the marker, kept for the card's list. */
export type UpdatedPage = {
  slug: string;
  entity_name: string | null;
  trust_score: number | null;
  updated_at: string;
};

export type HomeChanges = {
  since: string;
  /** Decisions anywhere in the corpus after `since`. */
  decisions: number;
  /** Distinct pages those decisions touched. */
  pagesTouched: number;
  /** Decisions that moved a score. */
  scoreMoves: number;
  /** Pages published or rewritten after `since` (from the recent list). */
  pagesUpdated: number;
  /**
   * True when every event in the feed window is newer than `since`, so the
   * real count is at least what is shown — the UI says "50+", not "50".
   */
  saturated: boolean;
  /** The decisions behind `decisions`, newest first (the feed window only). */
  decisionEvents: ActivityLike[];
  /** The pages behind `pagesUpdated`, newest first. */
  updatedPages: UpdatedPage[];
  /** Pages this phone has opened before whose record moved since it did. */
  yours: YourPageMove[];
};

export function homeChanges(
  lastVisit: string | null,
  activity: ReadonlyArray<ActivityLike>,
  recent: ReadonlyArray<{
    slug: string;
    updated_at: string;
    entity_name?: string | null;
    trust_score?: number | null;
  }>,
  readPages: Readonly<Record<string, PageSnapshot>>,
): HomeChanges | null {
  if (!lastVisit) return null;
  const fresh = activity.filter((e) => after(e.created_at, lastVisit));

  const yoursBySlug = new Map<string, YourPageMove>();
  for (const event of activity) {
    const read = readPages[event.slug];
    if (!read || !after(event.created_at, read.seenAt)) continue;
    const entry = yoursBySlug.get(event.slug) ?? {
      slug: event.slug,
      entity_name: event.entity_name,
      score: null,
      decisions: 0,
      latestAt: event.created_at,
    };
    entry.decisions += 1;
    if (after(event.created_at, entry.latestAt)) entry.latestAt = event.created_at;
    yoursBySlug.set(event.slug, entry);
  }
  // The score the reader saw vs the newest score decided SINCE they read it —
  // an older scored event must never be presented as a move since the read.
  for (const entry of yoursBySlug.values()) {
    const read = readPages[entry.slug];
    const newest = activity
      .filter(
        (e) =>
          e.slug === entry.slug &&
          typeof e.new_score === "number" &&
          read !== undefined &&
          after(e.created_at, read.seenAt),
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    entry.score = scoreMove(readPages[entry.slug]?.score, newest?.new_score);
  }

  const byNewest = (a: { created_at: string }, b: { created_at: string }) =>
    Date.parse(b.created_at) - Date.parse(a.created_at);
  const updatedPages: UpdatedPage[] = recent
    .filter((p) => after(p.updated_at, lastVisit))
    .map((p) => ({
      slug: p.slug,
      entity_name: p.entity_name ?? null,
      trust_score: typeof p.trust_score === "number" ? p.trust_score : null,
      updated_at: p.updated_at,
    }))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  const result: HomeChanges = {
    since: lastVisit,
    decisionEvents: [...fresh].sort(byNewest),
    updatedPages,
    decisions: fresh.length,
    pagesTouched: new Set(fresh.map((e) => e.slug)).size,
    scoreMoves: fresh.filter((e) => scoreMove(e.prev_score, e.new_score) !== null).length,
    pagesUpdated: updatedPages.length,
    saturated: activity.length > 0 && fresh.length === activity.length,
    yours: [...yoursBySlug.values()].sort(
      (a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt),
    ),
  };
  const any = result.decisions > 0 || result.pagesUpdated > 0 || result.yours.length > 0;
  return any ? result : null;
}

// ---------------------------------------------------------------------------
// Loop 2 — what moved on the pages you follow
// ---------------------------------------------------------------------------

/** What the Watch tab showed last time: when, and the score of each follow. */
export type WatchSnapshot = {
  seenAt: string;
  scores: Record<string, number | null>;
};

export type WatchMove = {
  slug: string;
  entity_name: string;
  score: ScoreMove | null;
  /** Decisions on this page since the last Watch visit, newest first. */
  events: DecisionLike[];
  latestAt: string | null;
};

export function watchMoves(
  previous: WatchSnapshot | null,
  followed: ReadonlyArray<{ slug: string; entity_name: string; trust_score: number | null }>,
  activity: ReadonlyArray<ActivityLike>,
): WatchMove[] {
  if (!previous) return [];
  const moves: WatchMove[] = [];
  for (const item of followed) {
    const events = activity
      .filter((e) => e.slug === item.slug && after(e.created_at, previous.seenAt))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const score =
      item.slug in previous.scores ? scoreMove(previous.scores[item.slug], item.trust_score) : null;
    if (!score && events.length === 0) continue;
    moves.push({
      slug: item.slug,
      entity_name: item.entity_name,
      score,
      events,
      latestAt: events[0]?.created_at ?? null,
    });
  }
  // Newest decision first; a score move with no feed event (older than the
  // feed window) sorts after the ones we can date.
  return moves.sort((a, b) => {
    if (a.latestAt && b.latestAt) return Date.parse(b.latestAt) - Date.parse(a.latestAt);
    if (a.latestAt) return -1;
    if (b.latestAt) return 1;
    return a.entity_name.localeCompare(b.entity_name);
  });
}

// ---------------------------------------------------------------------------
// Loop 6 — wallet re-scan
// ---------------------------------------------------------------------------

export type ScanHolding = {
  mint: string;
  symbol: string | null;
  slug: string | null;
  trust_score: number | null;
};

export type ScanSnapshot = {
  scannedAt: string;
  risk_score: number | null;
  holdings: ScanHolding[];
};

export type ScanDiff = {
  since: string;
  risk: ScoreMove | null;
  /** Holdings with a page both times whose score moved. */
  scoreChanges: Array<ScanHolding & { from: number; to: number }>;
  /** Holdings that had no page last time and have one now. */
  newlyCovered: ScanHolding[];
  /** In the wallet now, not last time. */
  added: ScanHolding[];
  /** In the wallet last time, not now. */
  removed: ScanHolding[];
  /**
   * True when either scan hit the provider's position cap, so "added" and
   * "removed" would be coverage noise rather than trades; both lists are then
   * left empty (WALLET_SCAN_SPEC: holdings are capped and sorted by value).
   */
  positionsCapped: boolean;
};

/** The scan's hard cap on positions (docs/WALLET_SCAN_SPEC.md, step 6). */
export const SCAN_POSITION_CAP = 300;

export function scanDiff(previous: ScanSnapshot | null, current: ScanSnapshot): ScanDiff | null {
  if (!previous) return null;
  const before = new Map(previous.holdings.map((h) => [h.mint, h]));
  const now = new Map(current.holdings.map((h) => [h.mint, h]));

  const scoreChanges: ScanDiff["scoreChanges"] = [];
  const newlyCovered: ScanHolding[] = [];
  const added: ScanHolding[] = [];
  for (const holding of current.holdings) {
    const old = before.get(holding.mint);
    if (!old) {
      added.push(holding);
      continue;
    }
    if (!old.slug && holding.slug) {
      newlyCovered.push(holding);
      continue;
    }
    // Same page both times: a mint re-linked to a different page is not a
    // score that moved.
    const move = scoreMove(old.trust_score, holding.trust_score);
    if (old.slug && holding.slug && old.slug === holding.slug && move) {
      scoreChanges.push({ ...holding, ...move });
    }
  }
  const removed = previous.holdings.filter((h) => !now.has(h.mint));
  const positionsCapped =
    previous.holdings.length >= SCAN_POSITION_CAP || current.holdings.length >= SCAN_POSITION_CAP;

  return {
    since: previous.scannedAt,
    risk: scoreMove(previous.risk_score, current.risk_score),
    scoreChanges,
    newlyCovered,
    added: positionsCapped ? [] : added,
    removed: positionsCapped ? [] : removed,
    positionsCapped,
  };
}

/** True when a diff has anything in it worth a line. */
export function scanDiffIsEmpty(diff: ScanDiff): boolean {
  return (
    diff.risk === null &&
    diff.scoreChanges.length === 0 &&
    diff.newlyCovered.length === 0 &&
    diff.added.length === 0 &&
    diff.removed.length === 0
  );
}
