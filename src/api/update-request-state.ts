/**
 * "Update this page" — what the button says after each outcome.
 *
 * Pure and import-free so `npm run test:logic` can run it under Node's type stripping.
 * The wording mirrors web/src/lib/update-request-ui.ts.
 */
export type UpdateRequestState =
  | { kind: "queued"; requestId?: string }
  | { kind: "already"; requestId?: string }
  | { kind: "limit"; limit: number | null }
  | { kind: "recently_updated"; nextAllowedAt: string | null }
  | { kind: "signed_out" }
  | { kind: "offline" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

/** A 200/201 from POST /api/requests { kind: "update" }. */
export function stateFromResponse(res: {
  already_requested?: boolean;
  request?: { id?: string } | null;
}): UpdateRequestState {
  // The request id, when the route sent one, lets the screen open the live
  // status page; without it the link goes to the public queue.
  const id = res.request?.id;
  const extra = typeof id === "string" && id ? { requestId: id } : {};
  return res.already_requested ? { kind: "already", ...extra } : { kind: "queued", ...extra };
}

/** A non-2xx: status 0 is the client's own network failure (see ApiError). */
export function stateFromFailure(status: number, body: unknown, message: string): UpdateRequestState {
  if (status === 401) return { kind: "signed_out" };
  if (status === 429) {
    const limit = (body as { limit?: unknown } | null)?.limit;
    return { kind: "limit", limit: typeof limit === "number" ? limit : null };
  }
  if (status === 409 && (body as { error?: unknown } | null)?.error === "recently_updated") {
    const next = (body as { next_allowed_at?: unknown }).next_allowed_at;
    return { kind: "recently_updated", nextAllowedAt: typeof next === "string" ? next : null };
  }
  if (status === 503) return { kind: "unavailable" };
  if (status === 0) return { kind: "offline" };
  return { kind: "error", message };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 9" (UTC) from an ISO timestamp, or null when missing or unparseable. */
export function shortDate(iso: string | null | undefined): string | null {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function updateRequestText(state: UpdateRequestState | null): string {
  if (!state) return "Update this page";
  switch (state.kind) {
    case "queued":
      return "✓ Update requested";
    case "already":
      return "✓ Update already requested";
    case "limit":
      return state.limit
        ? `Daily limit reached (${state.limit}). Try tomorrow.`
        : "Daily limit reached. Try tomorrow.";
    case "recently_updated": {
      const d = shortDate(state.nextAllowedAt);
      return d ? `Updated recently · again on ${d}` : "Updated recently · try again next week";
    }
    case "signed_out":
      return "Sign in to update this page";
    case "offline":
      return "Offline. Try again when you have a connection.";
    case "unavailable":
      return "Updates are unavailable right now.";
    case "error":
      return state.message;
  }
}

/** True once the ask is on the queue: the button stops offering it again. */
export function updateRequestDone(state: UpdateRequestState | null): boolean {
  return state?.kind === "queued" || state?.kind === "already" || state?.kind === "recently_updated";
}
