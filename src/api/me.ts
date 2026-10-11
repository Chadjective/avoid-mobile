/**
 * The signed-in account. Bearer-authenticated via
 * `getCurrentAccountFromRequest()` on the web side.
 */
import { apiRequest } from "./client";
import { meResponseSchema, meUpdateResponseSchema, type Account, type Me } from "./types";

/** GET /api/me — 401 when there is no valid session. */
export async function getMe(opts: { usage?: boolean } = {}): Promise<Me> {
  return apiRequest("/api/me", {
    schema: meResponseSchema,
    auth: "required",
    // Opt-in: the server only runs the usage counts for ?usage=1.
    ...(opts.usage ? { query: { usage: "1" } } : {}),
  });
}

/**
 * PATCH /api/me. With no `accounts` row yet, `handle` is required and creates
 * one; afterwards the handle is immutable and only display_name and
 * anon_by_default are editable.
 */
export async function updateMe(body: {
  handle?: string;
  display_name?: string | null;
  anon_by_default?: boolean;
}): Promise<{ account: Account; created: boolean }> {
  return apiRequest("/api/me", {
    method: "PATCH",
    body,
    schema: meUpdateResponseSchema,
    auth: "required",
  });
}

/**
 * Link a wallet to the signed-in account with a fresh SIWS proof
 * (docs/MOBILE_APP_SPEC.md §8, D3).
 *
 * `siws_message` is the exact text the wallet signed — MWA returns it base64
 * in `sign_in_result.signed_message`, so decode it to UTF-8 first, the way
 * solana/sign-in-with-solana.ts does. `siws_signature` goes over AS BASE64,
 * exactly as MWA returns it; the server (web/src/lib/siws.ts) accepts base64
 * or base58 and infers which from the decoded length.
 *
 * The server verifies the signature, the address and the domain before it
 * writes anything, then reads the wallet's Seeker Genesis Token and SKR
 * balance, so the returned account carries `seeker_verified` and `skr_tier`.
 * Failures: 400 `{error, reason}` with reason ∈ bad_signature ·
 * address_mismatch · domain_mismatch · expired · not_yet_valid · malformed,
 * and 409 when the wallet is already linked to a different account.
 *
 * `handle` is REQUIRED when this is the first call for a wallet-first user
 * (no accounts row yet); the server answers 400 `{error:"handle required"}`
 * otherwise. It is ignored once the row exists — the handle is immutable.
 */
export async function linkWallet(body: {
  wallet_pubkey: string;
  siws_message: string;
  siws_signature: string;
  handle?: string;
}): Promise<{ account: Account; created: boolean }> {
  return apiRequest("/api/me", {
    method: "PATCH",
    body,
    schema: meUpdateResponseSchema,
    auth: "required",
  });
}
