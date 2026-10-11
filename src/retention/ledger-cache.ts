/**
 * A tiny version counter for the Profile requests list.
 *
 * The signed-in list is cached for five minutes (ImpactLedger.tsx), and the
 * Profile tab stays mounted while the user is elsewhere. A request made from
 * Search, the request screen or an entity page must not wait out that window
 * (device test 0.2.6: "giga", queued, never appeared). Whatever creates a
 * request calls `markRequestsStale()`; the ledger compares versions before
 * trusting its cache.
 */
let version = 0;

export function markRequestsStale(): void {
  version += 1;
}

export function requestsVersion(): number {
  return version;
}
