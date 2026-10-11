/** Pure wording for the "your evidence" list (tests/scan-history.test.mjs). */

/** The verdict in words, from community_submissions.status. */
export function verdictWords(status: string): string {
  switch (status) {
    case "accepted":
      return "accepted";
    case "rejected":
      return "rejected";
    case "revoked":
      return "acceptance withdrawn";
    default:
      return "under review";
  }
}

/** "score 58 → 46", or null when the decision recorded no score move. */
export function scoreMoveText(s: { prev_score?: number | null; new_score?: number | null }): string | null {
  if (s.prev_score == null || s.new_score == null) return null;
  return `score ${Math.round(s.prev_score)} → ${Math.round(s.new_score)}`;
}

// ---------------------------------------------------------------------------
// "Your activity" on Profile: what you did and what came of it. Pure, so
// tests/activity.test.mjs can pin the wording.
// ---------------------------------------------------------------------------

export type OutcomeTone = "critical" | "warning" | "caution" | "verified" | "neutral";
export type Outcome = { label: string; tone: OutcomeTone };

/**
 * An investigation request's outcome pill, from `investigation_requests.status`
 * (queued | running | fulfilled | failed | rejected). An unknown value shows
 * as-is rather than being guessed at, so a status added server-side still reads.
 */
export function requestOutcome(status: string): Outcome {
  switch (status) {
    case "fulfilled":
      return { label: "Published", tone: "verified" };
    case "queued":
      return { label: "In queue", tone: "neutral" };
    case "running":
      return { label: "Researching", tone: "caution" };
    case "failed":
      return { label: "Failed", tone: "critical" };
    case "rejected":
      return { label: "Rejected", tone: "warning" };
    default:
      return { label: status || "Unknown", tone: "neutral" };
  }
}

/** A submission's verdict pill, from `community_submissions.status`. */
export function evidenceOutcome(status: string): Outcome {
  switch (status) {
    case "accepted":
      return { label: "Accepted", tone: "verified" };
    case "rejected":
      return { label: "Rejected", tone: "critical" };
    case "revoked":
      return { label: "Withdrawn", tone: "warning" };
    default:
      return { label: "Under review", tone: "caution" };
  }
}

export type ActivityCounts = {
  requests: number;
  published: number;
  accepted: number;
  rejected: number;
  scans: number;
};

/**
 * The counter row. Accepted / rejected come from `rep` (the server's own tally,
 * same numbers as avoid.net/me), not from the 20 recent submissions, which
 * would undercount an active contributor. Request and scan counts are what the
 * app has loaded: the account's request list and its last 10 scans.
 */
export function activityCounts(
  requests: Array<{ status: string }>,
  rep: { acceptedCount: number; rejectedCount: number } | null | undefined,
  scans: Array<{ status: string }>,
): ActivityCounts {
  return {
    requests: requests.length,
    published: requests.filter((r) => r.status === "fulfilled").length,
    accepted: rep?.acceptedCount ?? 0,
    rejected: rep?.rejectedCount ?? 0,
    scans: scans.filter((s) => s.status !== "failed").length,
  };
}

/** "12 tokens", "1 token", or null when the scan recorded no count. */
export function tokenCountText(n: number | null | undefined): string | null {
  if (n == null) return null;
  return n === 1 ? "1 token" : `${n} tokens`;
}
