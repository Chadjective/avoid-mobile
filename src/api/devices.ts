/**
 * Push device registration.
 *
 * contract: docs/MOBILE_APP_SPEC.md §8
 * ROUTE DOES NOT EXIST YET. Specified as:
 *   POST   /api/v1/devices          ← {expo_push_token, platform, app_version}
 *                                   → 201; idempotent on token
 *   DELETE /api/v1/devices/:token   → 204 (sign-out)
 * Backed by the `push_devices` table in migration 052 (§6).
 */
import { z } from "zod";
import { ApiError, apiRequest } from "./client";
import { registerDeviceResponseSchema } from "./contracts";

export { pushDeviceSchema, type PushDevice } from "./contracts";

/**
 * What POST /api/v1/devices actually answers: 201 `{id}` and nothing else
 * (web/src/app/api/v1/devices/route.ts, the upsert returns only the row id).
 * Parsing it as a full `PushDevice` failed on every success — the token was
 * stored server-side, the app reported an error, and this phone never
 * recorded that it gets pushes. Fixed 2026-09-26.
 */

/** contract: docs/MOBILE_APP_SPEC.md §8 — idempotent on the token. */
export async function registerDevice(body: {
  expo_push_token: string;
  platform: string;
  app_version?: string;
}): Promise<{ id: string }> {
  return apiRequest("/api/v1/devices", {
    method: "POST",
    body,
    schema: registerDeviceResponseSchema,
    auth: "required",
  });
}

/** contract: docs/MOBILE_APP_SPEC.md §8 — called on sign-out. */
export async function unregisterDevice(expoPushToken: string): Promise<void> {
  try {
    await apiRequest(`/api/v1/devices/${encodeURIComponent(expoPushToken)}`, {
      method: "DELETE",
      schema: z.unknown(),
      auth: "required",
    });
  } catch (err) {
    // 404 means this token is not registered to the caller (already removed,
    // or registered under another account): the goal, no pushes to this
    // account here, is already met.
    if (err instanceof ApiError && err.status === 404) return;
    throw err;
  }
}
