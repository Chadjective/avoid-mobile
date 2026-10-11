/**
 * The Alerts tab. Reads the account's own `notifications_outbox` rows, so what
 * the app shows and what the phone was pushed can never disagree.
 *
 * contract: docs/MOBILE_APP_SPEC.md §8
 * ROUTE DOES NOT EXIST YET. Specified as:
 *   GET /api/v1/feed?since=  → last 50 outbox rows for the account
 * Row shape is migration 053 (§6): the `kind` check constraint is the seven
 * values below, `data` is the deep-link target, `sent_at` is null until the
 * dispatcher sends it.
 */
import { apiRequest } from "./client";
import { feedResponseSchema, type Alert } from "./contracts";

export { alertKindSchema, alertSchema, type AlertKind, type Alert } from "./contracts";

/** contract: docs/MOBILE_APP_SPEC.md §8 */
export async function getFeed(since?: string): Promise<Alert[]> {
  const res = await apiRequest("/api/v1/feed", {
    schema: feedResponseSchema,
    auth: "required",
    query: { since },
  });
  return res.items;
}
