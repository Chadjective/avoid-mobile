/**
 * The corpus-wide decision feed — what changed anywhere, most recently.
 *
 * `GET /api/v1/activity` (web/src/app/api/v1/activity/route.ts), added for the
 * Search tab's empty state: with no query typed there is no slug to ask
 * `/api/v1/investigations/:slug/audit` about, so the app needed the other cut
 * of the same public record — the one the website renders at
 * https://www.avoid.net/data/activity. Public, no auth, `s-maxage=300` like
 * the rest of /v1.
 *
 * The row is NARROWER than the per-page audit row and the schema matches the
 * route, not the page: no `reason` and no `content_hash` (the route never
 * fetches the canonical bytes for a feed), no `anchor_slot` /
 * `anchor_block_time` (an explorer link needs only the signature and the
 * cluster), and — as everywhere — no `actor_pubkey` and no `submission_id`.
 * `slug` and `entity_name` come from the page the event happened to, so a row
 * is tappable.
 */
import { apiRequest } from "./client";
import { activityResponseSchema, type ActivityEvent } from "./contracts";

export { activityEventSchema, type ActivityEvent } from "./contracts";

/** Newest decision first, across every page. 1–50, default 20 server-side. */
export async function listActivity(
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<ActivityEvent[]> {
  const res = await apiRequest("/api/v1/activity", {
    schema: activityResponseSchema,
    auth: "none",
    query: { limit: options.limit },
    signal: options.signal,
  });
  return res.events;
}

/**
 * The decision verb in the words the pages use. `decision` is a database enum
 * (migration 004, widened since); anything unmapped falls through as itself
 * rather than being hidden, so a new verb shows up rather than disappearing.
 */
export function decisionLabel(decision: string): string {
  switch (decision) {
    case "accept":
      return "evidence accepted";
    case "reject":
      return "evidence rejected";
    case "mark_under_review":
      return "marked under review";
    case "revoke_acceptance":
      return "acceptance revoked";
    case "review_approve":
      return "review approved";
    case "review":
      return "reviewed";
    default:
      return decision.replace(/_/g, " ");
  }
}
