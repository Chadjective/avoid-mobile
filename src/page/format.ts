/**
 * Small pure helpers for the page screen (app/entity/[slug].tsx), kept out of
 * the component so `npm run test:logic` can cover them without React Native.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "-7", "+3", "0". Null when the row carries no delta at all. */
export function formatDelta(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return null;
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

/** Red for a drop, green for a rise, muted for no change. */
export function deltaTone(delta: number | null | undefined): "critical" | "verified" | "muted" {
  if (!delta) return "muted";
  return delta < 0 ? "critical" : "verified";
}

/** "review_revise" -> "REVIEW REVISE", as the website's decision log reads. */
export function decisionKindLabel(decision: string): string {
  return decision.replace(/[_-]+/g, " ").trim().toUpperCase();
}

/** "#3 REVIEW REVISE" — the sequence number is absent on pre-API rows. */
export function decisionHeading(seq: number | null | undefined, decision: string): string {
  const kind = decisionKindLabel(decision);
  return seq === null || seq === undefined ? kind : `#${seq} ${kind}`;
}

/** First few characters plus an ellipsis: "6WzQ…". Short values pass through. */
export function shortHash(hash: string | null | undefined, keep = 4): string | null {
  if (!hash) return null;
  return hash.length <= keep ? hash : `${hash.slice(0, keep)}…`;
}

/** "2026-06-03" from an ISO timestamp; falls back to the raw text. */
export function isoDate(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : value;
}

/** The plain-words link text on an anchored decision (the arrow and cluster suffix are the caller's). */
export function anchoredLabel(): string {
  return "Recorded on Solana ✓";
}

/** "slot 423949560 · hash 6WzQ…": the technical detail, shown small and muted. Null when both are missing. */
export function anchorDetailLine(
  slot: number | null | undefined,
  hash: string | null | undefined,
): string | null {
  const parts = [
    slot === null || slot === undefined ? "" : `slot ${slot}`,
    hash ? `hash ${hash}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Long enough that three lines will not hold it, so "more" is worth showing. */
export const CLAMP_CHARS = 140;
export function needsClamp(text: string | null | undefined): boolean {
  return !!text && text.length > CLAMP_CHARS;
}

/** The line above the audit rows. */
export function auditSummaryLine(
  events: ReadonlyArray<{ anchor_signature: string | null }>,
  total: number,
): string {
  const anchored = events.filter((e) => !!e.anchor_signature).length;
  if (events.length === 0) return "No decisions yet";
  if (anchored === 0) return `${plural(total, "decision")} · not recorded yet`;
  if (events.length < total) return `Recorded on Solana · ${anchored} of the latest ${events.length} decisions`;
  if (anchored === events.length) return `Recorded on Solana · ${plural(total, "decision")}`;
  return `Recorded on Solana · ${anchored} of ${plural(total, "decision")}`;
}

export type ContentsItem = { key: string; label: string };

/** Section titles, then "Timeline (N events)" when there is one. */
export function buildContents(input: {
  sectionHeadings: ReadonlyArray<string>;
  timelineCount: number;
}): ContentsItem[] {
  const items: ContentsItem[] = input.sectionHeadings.map((label, i) => ({
    key: `section-${i}`,
    label: label.trim() || `Section ${i + 1}`,
  }));
  if (input.timelineCount > 0) {
    items.push({ key: "timeline", label: `Timeline (${plural(input.timelineCount, "event")})` });
  }
  return items;
}

/** "Contents · 17 sources · 16 events"; zero counts are left out. */
export function contentsHeading(sourceCount: number, eventCount: number): string {
  return [
    "Contents",
    sourceCount > 0 ? plural(sourceCount, "source") : "",
    eventCount > 0 ? plural(eventCount, "event") : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Distinct sources across the page-level list and every section's own list,
 * keyed by URL (sources without one by name). Used for the Contents heading.
 */
export function countUniqueSources(
  pageSources: ReadonlyArray<{ url?: string | null; name?: string | null }> | null | undefined,
  sections: ReadonlyArray<{ sources?: ReadonlyArray<{ url?: string | null; name?: string | null }> | null }> | null | undefined,
): number {
  const seen = new Set<string>();
  const add = (s: { url?: string | null; name?: string | null }) => {
    const key = (s.url || s.name || "").trim();
    if (key) seen.add(key);
  };
  (pageSources ?? []).forEach(add);
  (sections ?? []).forEach((section) => (section.sources ?? []).forEach(add));
  return seen.size;
}

/** The fact-check button's own label: the outcome lives in the button, not beside it. */
export function factCheckButtonLabel(kind: string | null | undefined, saving: boolean): string {
  if (saving) return "Requesting…";
  if (kind === "requested") return "Fact-check requested ✓";
  if (kind === "already") return "Already requested today ✓";
  return "Request fact-check";
}

// ---------------------------------------------------------------------------
// Action block states (Follow / Submit evidence / Update / Request fact-check)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** Both cool-downs are a week: a page updated or fact-checked inside it is "recent". */
export const ACTION_COOLDOWN_DAYS = 7;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** "14 hours ago", "yesterday", "4 months ago"; "" when the date is missing. */
export function agoText(iso: string | null | undefined, now: number): string {
  const t = ms(iso);
  if (t === null) return "";
  const minutes = Math.floor(Math.max(0, now - t) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "1 year ago" : `${years} years ago`;
}

/** "again in 6 days" / "again in 5 hours"; "" when the time has passed or is unknown. */
export function againInText(nextIso: string | null | undefined, now: number): string {
  const t = ms(nextIso);
  if (t === null || t <= now) return "";
  const left = t - now;
  if (left < DAY_MS) {
    const h = Math.max(1, Math.round(left / HOUR_MS));
    return h >= 24 ? "again in 1 day" : `again in ${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const d = Math.round(left / DAY_MS);
  return `again in ${d} ${d === 1 ? "day" : "days"}`;
}

export type ActionBlockInput = {
  now: number;
  /** Detail `content_updated_at` (the last real content change); absent on an older server. */
  contentUpdatedAt?: string | null;
  /** The old `updated_at`, used when `content_updated_at` is absent. */
  updatedAt?: string | null;
  updateNextAllowedAt?: string | null;
  lastFactCheckedAt?: string | null;
  factCheckNextAllowedAt?: string | null;
  /** The page has a completed fact-check (hides the fact-check button unless it is recent). */
  reviewed?: boolean | null;
  /** `next_allowed_at` from a POST /api/review-requests `{ ok:false, reason:"cooldown" }` reply. */
  cooldownNextAllowedAt?: string | null;
  /** The reply was a cooldown (even if it carried no date). */
  cooldownReply?: boolean;
};

export type ActionSpec = { label: string; sublabel?: string; disabled: boolean };

export type ActionBlockState = {
  recentlyUpdated: boolean;
  recentlyFactChecked: boolean;
  /** Submit evidence goes full width at the top, highlighted. */
  promoteSubmit: boolean;
  submitSublabel: string | null;
  update: ActionSpec;
  /** Null when the button is not shown at all. */
  factCheck: ActionSpec | null;
};

/**
 * Which of the action block's three states applies, and the labels in each
 * button. Every date field is optional: an older server omits them and the
 * block falls back to `updated_at` and a plain normal state.
 */
export function actionBlockState(i: ActionBlockInput): ActionBlockState {
  const now = i.now;
  const contentAt = i.contentUpdatedAt || i.updatedAt || null;

  // Update cool-down: the server's date when it sends one, else 7 days after the content change.
  const contentT = ms(i.contentUpdatedAt);
  const updateNext =
    i.updateNextAllowedAt ??
    (contentT !== null ? new Date(contentT + ACTION_COOLDOWN_DAYS * DAY_MS).toISOString() : null);
  const updateNextT = ms(updateNext);
  const recentlyUpdated = updateNextT !== null && updateNextT > now;

  // Fact-check cool-down, same shape (a cooldown reply from the POST wins).
  const checkedT = ms(i.lastFactCheckedAt);
  const checkNext =
    i.cooldownNextAllowedAt ??
    i.factCheckNextAllowedAt ??
    (checkedT !== null ? new Date(checkedT + ACTION_COOLDOWN_DAYS * DAY_MS).toISOString() : null);
  const checkNextT = ms(checkNext);
  const recentlyFactChecked = !!i.cooldownReply || (checkNextT !== null && checkNextT > now);

  const update: ActionSpec = { label: "Update this page", disabled: false };
  if (recentlyUpdated) {
    update.disabled = true;
    update.sublabel = [
      `updated ${agoText(i.contentUpdatedAt ?? contentAt, now)}`.trim(),
      againInText(updateNext, now),
    ]
      .filter(Boolean)
      .join(" · ");
  } else {
    const ago = agoText(contentAt, now);
    update.sublabel = ago ? `last updated ${ago}` : "last update unknown";
  }

  let factCheck: ActionSpec | null = null;
  if (recentlyFactChecked) {
    const ago = agoText(i.lastFactCheckedAt, now);
    factCheck = {
      label: "Fact-checked",
      disabled: true,
      sublabel: [ago, againInText(checkNext, now)].filter(Boolean).join(" · ") || undefined,
    };
  } else if (!i.reviewed) {
    factCheck = { label: "Request fact-check", disabled: false };
  }

  let submitSublabel: string | null = null;
  if (recentlyUpdated) {
    submitSublabel = "Recently updated. Know something it missed? Send it in.";
  } else if (recentlyFactChecked) {
    const ago = agoText(i.lastFactCheckedAt, now);
    submitSublabel = `Fact-checked ${ago || "recently"}. New evidence still goes to review.`;
  }

  return {
    recentlyUpdated,
    recentlyFactChecked,
    promoteSubmit: recentlyUpdated || recentlyFactChecked,
    submitSublabel,
    update,
    factCheck,
  };
}

/**
 * Rows of action keys. Normal: two per row, an odd last item spans the row.
 * Promoted: Submit evidence alone on top, the rest two per row.
 */
export function arrangeActions(keys: ReadonlyArray<string>, promoteSubmit: boolean): string[][] {
  const rest = promoteSubmit ? keys.filter((k) => k !== "submit") : [...keys];
  const rows: string[][] = [];
  if (promoteSubmit && keys.includes("submit")) rows.push(["submit"]);
  for (let n = 0; n < rest.length; n += 2) rows.push(rest.slice(n, n + 2));
  return rows;
}
