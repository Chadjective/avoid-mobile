/**
 * Notification tap -> screen. PURE (no React Native / expo imports) so it runs
 * under plain node --test.
 *
 * Payloads come from the Railway dispatcher (src/notify_dispatch_worker.py via
 * src/bots/outbox.py). `data` per kind:
 *   score_changed / evidence_accepted / review_verdict  {slug, event_id}
 *   page_published                                      {slug}
 *   wallet_activity                                     {slug, activity_id, direction}
 *   request_fulfilled                                   {slug, request_id}
 *   scan_complete                                       (no producer yet; no slug)
 *   digest (over-cap rollup)                            {digest: true, count}
 *   test push (devices route)                           {slug, url, test: true}
 * Nothing in `data` carries a kind, so routing is by which fields are present.
 */

export const ALERTS_ROUTE = "/alerts";

/** Page slugs are lowercase kebab-case; anything else is not routed to. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
/** Request ids are UUIDs (investigation_requests.id). */
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG.test(value);
}

export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID.test(value);
}

/**
 * Where a tapped notification goes. Digests and anything unrecognised or
 * malformed open the Alerts tab. A slug wins over a request id: the page is
 * the thing the notification is about, and a fulfilled request carries both.
 */
export function routeForNotificationData(data: unknown): string {
  if (typeof data !== "object" || data === null) return ALERTS_ROUTE;
  const d = data as Record<string, unknown>;
  if (d.digest === true) return ALERTS_ROUTE;
  if (isValidSlug(d.slug)) return `/entity/${d.slug}`;
  if (isValidRequestId(d.request_id)) return `/request/${d.request_id}`;
  return ALERTS_ROUTE;
}
