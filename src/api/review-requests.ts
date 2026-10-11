/**
 * "Request fact-check" — POST /api/review-requests { slug }.
 *
 * It records demand: the nightly fact-check run reviews the most-requested
 * pages first, so asking moves a page from unchecked toward fact-checked
 * sooner. No account needed (the route reads no session); it is limited to one
 * request per person per page per day.
 *
 * Answers: 200 `{ ok, requests, already }` (`already` = you asked today),
 * 404 page unknown, 503 unavailable, 400/413 bad body.
 */
import { z } from "zod";
import { ApiError, apiRequest } from "./client";

const reviewRequestResponseSchema = z.object({
  ok: z.boolean().optional(),
  requests: z.number().nullable().optional(),
  already: z.boolean().optional(),
  /** `{ ok:false, reason:"cooldown", next_allowed_at }`: fact-checked in the last 7 days. */
  reason: z.string().nullable().optional(),
  next_allowed_at: z.string().nullable().optional(),
});

export type FactCheckRequestState =
  | { kind: "requested" }
  | { kind: "already" }
  | { kind: "cooldown"; nextAllowedAt: string | null }
  | { kind: "unavailable" }
  | { kind: "offline" }
  | { kind: "error" };

export async function requestFactCheck(slug: string): Promise<FactCheckRequestState> {
  try {
    const res = await apiRequest("/api/review-requests", {
      method: "POST",
      body: { slug },
      schema: reviewRequestResponseSchema,
      auth: "none",
    });
    if (res.reason === "cooldown" || res.ok === false) {
      if (res.reason === "cooldown") return { kind: "cooldown", nextAllowedAt: res.next_allowed_at ?? null };
      return { kind: "error" };
    }
    return res.already ? { kind: "already" } : { kind: "requested" };
  } catch (err) {
    if (err instanceof ApiError) {
      // The cooldown reply may arrive on a non-2xx status.
      const body = err.body as { reason?: unknown; next_allowed_at?: unknown } | null;
      if (body && body.reason === "cooldown") {
        return {
          kind: "cooldown",
          nextAllowedAt: typeof body.next_allowed_at === "string" ? body.next_allowed_at : null,
        };
      }
      // 429 is not sent today; if it ever is, it means the same as `already`.
      if (err.status === 429) return { kind: "already" };
      if (err.status === 503 || err.status === 404) return { kind: "unavailable" };
      if (err.status === 0) return { kind: "offline" };
    }
    return { kind: "error" };
  }
}

/** The result line under the button; null before it has been pressed. */
export function factCheckText(state: FactCheckRequestState | null): string | null {
  if (!state) return null;
  switch (state.kind) {
    case "requested":
      return "Fact-check requested. Pages people ask about are reviewed first.";
    case "already":
      return "Already requested today.";
    case "cooldown":
      return "Fact-checked recently.";
    case "unavailable":
      return "Not available right now.";
    case "offline":
      return "Offline. Try again when you have a connection.";
    case "error":
      return "Couldn't send the request. Try again.";
  }
}
