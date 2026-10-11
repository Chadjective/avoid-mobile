/**
 * One copy of the corpus-wide decision feed per app session.
 *
 * Three screens compare against "what happened recently": the Search tab's
 * feed and its "since your last visit" card, and the Watch tab's "what
 * moved". Each used to be (or would have been) its own request with its own
 * `limit`, and a different query string is a different CDN cache entry, so
 * the edge could not share them either. They now share ONE
 * `GET /api/v1/activity?limit=50` (the route's maximum), fetched at most once
 * per app process and again only on an explicit pull-to-refresh.
 *
 * Public, `s-maxage=300`: most of these are served by the CDN for nothing
 * (CLAUDE.md: every request is a billed Vercel invocation). No polling.
 */
import { listActivity, type ActivityEvent } from "../api/activity";

export const ACTIVITY_WINDOW = 50;

let cached: ActivityEvent[] | null = null;
let inFlight: Promise<ActivityEvent[]> | null = null;

/**
 * The feed, from memory when this session already has it. Concurrent callers
 * share one request. `force` is for pull-to-refresh only.
 */
export function getActivity(options: { force?: boolean } = {}): Promise<ActivityEvent[]> {
  if (cached && !options.force) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  inFlight = listActivity({ limit: ACTIVITY_WINDOW })
    .then((events) => {
      cached = events;
      return events;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Whatever this session already holds, without a request. */
export function peekActivity(): ActivityEvent[] | null {
  return cached;
}
