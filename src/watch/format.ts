/**
 * Wording for the Watch tab's compact rows. Pure (tests/watch-format.test.mjs).
 * Everything here renders only what the API sent; a missing field yields null.
 */

function span(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const minutes = Math.max(0, Math.floor((now - then) / 60000));
  if (minutes < 60) return null; // "just now" handled by caller
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "1 day" : `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month" : `${months} months`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "1 year" : `${years} years`;
}

/** "following 23 hours" / "following less than an hour". Null without a date. */
export function followingFor(createdAt: string | null | undefined, now: number = Date.now()): string | null {
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  const s = span(createdAt, now);
  return s ? `following ${s}` : "following less than an hour";
}

/** "exchange" -> "Exchange", "defi_protocol" -> "Defi protocol". */
export function entityTypeLabel(type: string | null | undefined): string | null {
  const t = type?.replace(/[_-]+/g, " ").trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Line 2: "Exchange · following 23 hours" (parts that exist, joined). */
export function metaLine(
  item: { entity_type?: string | null; created_at?: string | null },
  now: number = Date.now(),
): string {
  return [entityTypeLabel(item.entity_type), followingFor(item.created_at, now)]
    .filter((p): p is string => !!p)
    .join(" · ");
}

/** Line 3: "Top risk: Rug pull · 4 events", or null when neither is known. */
export function riskLine(item: { top_risk?: string | null; event_count?: number | null }): string | null {
  const parts: string[] = [];
  if (item.top_risk?.trim()) parts.push(`Top risk: ${item.top_risk.trim()}`);
  if (typeof item.event_count === "number") {
    parts.push(`${item.event_count} ${item.event_count === 1 ? "event" : "events"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Expanded detail: "Score last moved 3 days ago (72 → 58)". `when` is the
 * already-worded relative time ("3 days ago"). The arrow part needs both
 * scores; with only a date the line is just the date.
 */
export function scoreMovedLine(
  when: string,
  previous: number | null | undefined,
  now: number | null | undefined,
): string | null {
  if (!when) return null;
  const range =
    typeof previous === "number" && typeof now === "number" ? ` (${previous} → ${now})` : "";
  return `Score last moved ${when}${range}`;
}
