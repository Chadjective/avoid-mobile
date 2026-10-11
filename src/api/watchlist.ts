/**
 * Watchlist — follow an entity or an address, and get pushed when it changes.
 *
 * contract: docs/MOBILE_APP_SPEC.md §8
 * NONE OF THESE ROUTES EXIST YET. They are specified as:
 *   GET    /api/v1/watchlist       → {items:[{target_kind, slug?, address?,
 *                                    entity_name?, trust_score?, band, muted}]}
 *   POST   /api/v1/watchlist       ← {target_kind, slug?, address?, chain?}
 *                                  → 201 item; 409 over the tier cap (10 free / 50 SKR)
 *   DELETE /api/v1/watchlist/:id   → 204
 *   PATCH  /api/v1/watchlist/:id   ← {muted} → item
 * All Bearer-authenticated, `Cache-Control: private, no-store`, and registered
 * as dynamic in web/scripts/verify-rendering-contract.mjs in the same commit.
 *
 * `band` is the four-band page verdict (CRITICAL / WARNING / CAUTIONARY /
 * LOW_RISK) — web/src/lib/trust-bands.ts `bandForPageScore`, which was moved
 * out of the TrustGauge component precisely so a route handler could band a
 * score. A row with no score has no band, hence nullable. The top band was
 * "VERIFIED" before Sept 2026; that legacy value is still accepted and read
 * as LOW_RISK, so this build parses a server from either side of the rename.
 */
import { z } from "zod";
import { apiRequest } from "./client";
import {
  watchlistItemResponseSchema,
  watchlistResponseSchema,
  type WatchTargetKind,
  type WatchlistItem,
} from "./contracts";

export {
  watchTargetKindSchema,
  watchlistItemSchema,
  type WatchTargetKind,
  type WatchlistItem,
} from "./contracts";

/** contract: docs/MOBILE_APP_SPEC.md §8 */
export async function listWatchlist(): Promise<WatchlistItem[]> {
  const res = await apiRequest("/api/v1/watchlist", {
    schema: watchlistResponseSchema,
    auth: "required",
  });
  return res.items;
}

/**
 * POST and PATCH wrap the row as `{item}` (web/src/app/api/v1/watchlist/
 * route.ts and [id]/route.ts). The client used to parse a bare row, so every
 * successful Follow and Mute surfaced as "Unexpected response shape". Fixed
 * 2026-09-26.
 */
const itemResponseSchema = watchlistItemResponseSchema;

/**
 * 201 new, 200 when already followed (idempotent, checked before the cap),
 * 409 `{error, limit}` over the tier cap (10 free / 50 SKR holders), 403
 * `{error: "Create a handle first"}` for a session with no account row.
 */
export async function follow(target: {
  target_kind: WatchTargetKind;
  slug?: string;
  address?: string;
  chain?: string;
}): Promise<WatchlistItem> {
  const res = await apiRequest("/api/v1/watchlist", {
    method: "POST",
    body: target,
    schema: itemResponseSchema,
    auth: "required",
  });
  return res.item;
}

/** contract: docs/MOBILE_APP_SPEC.md §8 — 204, no body. */
export async function unfollow(id: string): Promise<void> {
  await apiRequest(`/api/v1/watchlist/${encodeURIComponent(id)}`, {
    method: "DELETE",
    schema: z.unknown(),
    auth: "required",
  });
}

/** contract: docs/MOBILE_APP_SPEC.md §8 */
export async function setMuted(id: string, muted: boolean): Promise<WatchlistItem> {
  const res = await apiRequest(`/api/v1/watchlist/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { muted },
    schema: itemResponseSchema,
    auth: "required",
  });
  return res.item;
}
