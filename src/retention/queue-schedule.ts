/**
 * When the investigation queue is next drained — the one "expected wait" the
 * app can state honestly.
 *
 * `GET /api/requests/:id` returns status, priority and created_at, and no
 * queue position or ETA (checked 2026-09-26). What IS real is the schedule:
 * a Claude Routine runs `/drain-queue 10` every four hours, at 00:00, 04:00,
 * 08:00, 12:00, 16:00 and 20:00 UTC (docs/CRON_RUNBOOK.md, trigger
 * `trig_01Mxs9du6Ru3dje8LSVW6rSY`; moved from 12/17/23 UTC on 2026-10-02 so no
 * request waits 13 hours overnight). Each run takes up to ten
 * requests, highest priority first.
 *
 * So the screen says "the next queue run is in about 3 hours", which is a
 * schedule, not a promise that THIS request is in it — a busy queue can hold a
 * request for more than one run, and the copy says so (RETENTION_LOOPS_SPEC
 * §7: no countdown not backed by a real schedule).
 *
 * HARD-CODED, AND THAT IS A DEBT. If the Routine's cron changes, this file
 * must change with it. The better fix is a `next_drain_at` on the request
 * route (proposed in RETENTION_LOOPS_SPEC §9a); until then this is the single
 * place the schedule lives in the app.
 *
 * PURE: no imports, so it runs under plain Node for the tests.
 */

/** UTC hours of the drain Routine (`0 0,4,8,12,16,20 * * *`). */
export const DRAIN_HOURS_UTC: readonly number[] = [0, 4, 8, 12, 16, 20];

/** `/drain-queue 10` — requests taken per run. */
export const DRAIN_BATCH = 10;

/** The next scheduled drain strictly after `now`. */
export function nextDrainAt(now: Date = new Date()): Date {
  const hours = [...DRAIN_HOURS_UTC].sort((a, b) => a - b);
  for (let dayOffset = 0; dayOffset < 2; dayOffset += 1) {
    for (const hour of hours) {
      const candidate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour, 0, 0),
      );
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }
  // Unreachable with a non-empty schedule; a day from now is a safe answer.
  return new Date(now.getTime() + 24 * 3_600_000);
}

/** Drain runs that have started since `iso` (a request's created_at). */
export function drainsSince(iso: string, now: Date = new Date()): number {
  const start = Date.parse(iso);
  if (Number.isNaN(start)) return 0;
  let count = 0;
  let cursor = new Date(start);
  // Bounded walk: a request older than 30 days is not a queue question.
  for (let i = 0; i < 90; i += 1) {
    const next = nextDrainAt(cursor);
    if (next.getTime() > now.getTime()) break;
    count += 1;
    cursor = next;
  }
  return count;
}

/** "in about 3 hours", "in about 40 minutes", "any minute now". */
export function untilInWords(target: Date, now: Date = new Date()): string {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (minutes <= 5) return "any minute now";
  if (minutes < 60) return `in about ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

/**
 * The server's own estimate for a queued request, when it sent one
 * (`queue_position` and `estimated_run_at` on GET /api/requests/:id). Returns
 * null, and the screen falls back to the local schedule, when the server did
 * not send them, sent something unparseable, or its estimated run time has
 * already passed (a stale answer must not become a negative countdown).
 */
export function serverEstimate(
  position: number | null | undefined,
  estimatedRunAt: string | null | undefined,
  now: Date = new Date(),
): { position: number; runAt: Date } | null {
  if (typeof position !== "number" || !Number.isInteger(position) || position < 1) return null;
  if (!estimatedRunAt) return null;
  const run = new Date(estimatedRunAt);
  if (Number.isNaN(run.getTime()) || run.getTime() <= now.getTime()) return null;
  return { position, runAt: run };
}
