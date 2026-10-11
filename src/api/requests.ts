/**
 * Investigation requests — the queue the Claude Code `/drain-queue` run picks
 * up. The route deliberately does not kick the paid-API drain; a request sits
 * in `queued` until the subagent path runs it.
 */
import { z } from "zod";
import { ApiError, apiRequest } from "./client";
import { stateFromFailure, stateFromResponse, type UpdateRequestState } from "./update-request-state";
import { readEditToken, rememberEditToken } from "./request-edit-token";
import { rememberDeviceRequest } from "../retention/memory";
import { markRequestsStale } from "../retention/ledger-cache";
import {
  notifyEmailResponseSchema,
  requestCreateResponseSchema,
  requestListResponseSchema,
  investigationRequestSchema,
  type InvestigationRequest,
  type NotifyEmailResponse,
  type RequestCreateResponse,
} from "./types";

/**
 * POST /api/requests — anonymous 3/day, signed-in 10/day, 429 past that.
 *
 * The 201 carries `edit_token` ONCE. It is kept here, before the caller sees
 * the response, because it is what later authorises `setNotifyEmail` for a
 * requester with no account, and the route stores only its hash — nothing can
 * recover it afterwards.
 */
export async function createRequest(entity: string, context?: string): Promise<RequestCreateResponse> {
  const res = await apiRequest("/api/requests", {
    method: "POST",
    body: { entity: entity.trim(), context: context?.trim() || undefined },
    schema: requestCreateResponseSchema,
    auth: "optional",
  });
  if (res.request?.id && res.edit_token) {
    await rememberEditToken(res.request.id, res.edit_token);
  }
  // Loop 4: Profile lists what this phone asked for and what became of it,
  // including for someone who never signs in. On-device only.
  if (res.request?.id) {
    markRequestsStale();
    await rememberDeviceRequest({
      id: res.request.id,
      entity: res.request.entity_name ?? entity.trim(),
      created_at: res.request.created_at,
    });
  }
  return res;
}

/**
 * POST /api/requests { kind: "update", slug } — ask for an EXISTING page to be
 * re-researched. Signed-in only (401 otherwise) and on the same daily budget as
 * new requests (429 past it), so this uses `auth: "required"` and throws before
 * any network call when there is no session.
 *
 * 201 = queued; 200 with `already_requested` = an update is already open for
 * this page (from anyone), which costs no budget. No edit token comes back: the
 * owner proves themselves by session, and there is nothing to notify about.
 */
export async function requestPageUpdate(slug: string, entityName?: string): Promise<UpdateRequestState> {
  try {
    const res = await apiRequest("/api/requests", {
      method: "POST",
      body: { kind: "update", slug },
      schema: requestCreateResponseSchema,
      auth: "required",
    });
    // Profile lists what this phone asked for, so an update shows there too.
    if (res.request?.id && !res.already_requested) {
      markRequestsStale();
      await rememberDeviceRequest({
        id: res.request.id,
        entity: res.request.entity_name ?? entityName ?? slug,
        created_at: res.request.created_at,
      });
    }
    return stateFromResponse(res);
  } catch (err) {
    if (err instanceof ApiError) return stateFromFailure(err.status, err.body, err.message);
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/** GET /api/requests — the caller's own requests; 401 when signed out. */
export async function listMyRequests(): Promise<InvestigationRequest[]> {
  try {
    const res = await apiRequest("/api/requests", {
      schema: requestListResponseSchema,
      auth: "required",
    });
    return res.requests;
  } catch (err) {
    // The route answers 401 "Sign in to view your requests" both for no
    // session and for a valid session with no handle yet (it gates on the
    // accounts row, not the login). Someone with no handle has made no
    // account-bound requests, so that is an empty list, not an error card.
    if (err instanceof ApiError && err.status === 401 && err.code !== "not_signed_in") return [];
    throw err;
  }
}

/**
 * GET /api/requests/:id — PUBLIC (no session check in the handler), which is
 * what lets an anonymous requester keep a status screen open. 404 when the id
 * is unknown. Returns the row wrapped in `{ request }`.
 */
export async function getRequest(id: string): Promise<InvestigationRequest> {
  const res = await apiRequest(`/api/requests/${encodeURIComponent(id)}`, {
    schema: z.object({ request: investigationRequestSchema }),
    auth: "optional",
  });
  return res.request;
}

/** The statuses that end the wait. Mirrors web/src/app/request/[id]/page.tsx. */
const TERMINAL: ReadonlySet<string> = new Set(["fulfilled", "failed", "rejected"]);

export function isRequestTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

/**
 * PATCH /api/requests/:id — attach an address to be emailed when the request
 * resolves.
 *
 * TWO PROOFS, NOT NONE. The route used to take an address from anyone who knew
 * the request id, which is public (see `getRequest` above). It now needs proof
 * that the caller owns the REQUEST — the session for a signed-in owner, or the
 * `X-Request-Edit-Token` capability stored by `createRequest` for everyone else
 * — and it treats the address itself as unproven: 403 without the first, and a
 * confirmation link mailed for the second unless the caller is signed in and
 * gave their own account email.
 *
 * So the answer is no longer a bare `{ok:true}`. `confirmed` says whether we
 * may actually send to that address, and the screen has to say so — promising
 * "we will email you" for an address nobody has confirmed is a promise the
 * Fulfilment bot will not keep (it mails confirmed addresses only).
 *
 * Throws ApiError 403 when this device holds neither proof, and 429 past the
 * per-caller daily limit.
 */
export async function setNotifyEmail(id: string, email: string): Promise<NotifyEmailResponse> {
  const token = await readEditToken(id);
  return apiRequest(`/api/requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { notify_email: email.trim() },
    headers: token ? { "X-Request-Edit-Token": token } : undefined,
    schema: notifyEmailResponseSchema,
    auth: "optional",
  });
}

/** True when this device holds the capability to manage that request. */
export async function hasRequestEditToken(id: string): Promise<boolean> {
  return (await readEditToken(id)) !== null;
}
