/**
 * Pure helpers behind the request screen's countdown arc and stage bar.
 *
 * No imports, so `npm run test:logic` runs it under plain Node. Nothing here
 * reads a clock: callers pass `now`, which is what lets the screen animate off
 * a local one-second timer without a single extra network request.
 */

/** The three marks on the stage bar, in order. */
export const REQUEST_STAGES = ["Queued", "Researching", "Published"] as const;

/** The queue is drained every four hours (src/retention/queue-schedule.ts). */
export const DRAIN_INTERVAL_MS = 4 * 3_600_000;

export type RequestStage = {
  /** Index into REQUEST_STAGES of the stage the request is in (or stopped at). */
  index: number;
  /** Every stage is done. */
  complete: boolean;
  /** failed / rejected: the bar stops where it stopped rather than finishing. */
  stopped: boolean;
};

/**
 * Status → stage. The API reports only queued, running and fulfilled: `running`
 * covers research through saving, so the bar sits on Researching while it runs
 * and never claims a step the server did not report. A failed or rejected
 * request stops at the stage it plausibly reached (a failure only happens once
 * a run started, a rejection happens before one).
 */
export function stageFromStatus(status: string): RequestStage {
  switch (status) {
    case "queued":
      return { index: 0, complete: false, stopped: false };
    case "running":
      return { index: 1, complete: false, stopped: false };
    case "fulfilled":
      return { index: REQUEST_STAGES.length - 1, complete: true, stopped: false };
    case "failed":
      return { index: 1, complete: false, stopped: true };
    case "rejected":
      return { index: 0, complete: false, stopped: true };
    default:
      return { index: 0, complete: false, stopped: false };
  }
}

/**
 * Where the countdown window starts. A request waits for ONE run, so the arc
 * covers the shorter of "since I asked" and "one full drain interval before the
 * run": a request made a minute ago starts at empty, one that has waited three
 * hours does not look nearly done, nor does it ever start before its own
 * creation.
 */
export function arcWindowStart(createdAtMs: number, runAtMs: number): number {
  const earliest = runAtMs - DRAIN_INTERVAL_MS;
  if (!Number.isFinite(createdAtMs)) return earliest;
  return Math.max(createdAtMs, earliest);
}

/** 0 at the start of the window, 1 at (or past) the run. Always in [0, 1]. */
export function arcFraction(startMs: number, endMs: number, nowMs: number): number {
  const span = endMs - startMs;
  if (!Number.isFinite(span) || span <= 0) return 1;
  const f = (nowMs - startMs) / span;
  if (!Number.isFinite(f)) return 0;
  return Math.min(1, Math.max(0, f));
}

/** "4:05", "59:59", "1:02:03". Never negative. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(msLeft) ? msLeft : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Dots for the people ahead of you: position 3 means two ahead. Capped so a
 * long queue stays one tidy row, with the overflow counted.
 */
export function placeInLine(
  position: number,
  maxDots = 10,
): { ahead: number; dots: number; more: number; text: string } {
  const pos = Number.isInteger(position) && position >= 1 ? position : 1;
  const ahead = pos - 1;
  const dots = Math.min(ahead, Math.max(0, maxDots));
  return {
    ahead,
    dots,
    more: ahead - dots,
    text: ahead === 0 ? "You're next in line" : `You're #${pos} in line`,
  };
}
