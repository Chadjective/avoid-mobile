/**
 * Relative time in human units — "3 hours ago", never "2026-09".
 *
 * docs/RETENTION_LOOPS_SPEC.md §6: freshness is the proof of life, so every
 * timestamp a person reads says how long ago, in words. The exact date is
 * still one tap away wherever it matters (the audit trail keeps the ISO
 * string for the explorer link).
 *
 * PURE: no React Native imports, so the diff tests can run it under plain
 * Node (see docs/overnight notes). Deliberately not a library — the app only
 * needs to say how stale a thing is, and a clock skew of a few seconds must
 * not render as a future timestamp, so anything under a minute is "just now".
 */

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
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

/**
 * How long something has been waiting — "for 3 hours", "for 2 days". Used by
 * the request screen, where the honest thing to show is elapsed time, not a
 * countdown nobody can back (RETENTION_LOOPS_SPEC §7: no fake urgency).
 */
export function elapsed(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}
