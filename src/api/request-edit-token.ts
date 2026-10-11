/**
 * Custody of the per-request edit token on the phone.
 *
 * POST /api/requests returns `edit_token` exactly once — the web route stores
 * only its sha256, so it cannot be re-read (web/src/lib/request-tokens.ts). It
 * is the only thing that authorises PATCH /api/requests/:id for a requester
 * with no account, so it has to be kept from the moment the request is created.
 *
 * expo-secure-store rather than AsyncStorage, for the same reason the Supabase
 * session lives there (src/api/secure-storage.ts): this is a bearer credential.
 * No chunking is needed — the token is 43 characters, far inside SecureStore's
 * 2048-byte value limit.
 *
 * Every call is wrapped. A device with no keystore, or a key the OS refuses,
 * must degrade to "sign in to manage notifications" rather than throwing inside
 * a request flow.
 */
import * as SecureStore from "expo-secure-store";

/** SecureStore keys allow [A-Za-z0-9._-]; a request id is a UUID, so it fits. */
const PREFIX = "avoid_request_edit_token_";

function keyFor(requestId: string): string {
  return PREFIX + requestId.replace(/[^A-Za-z0-9._-]/g, "");
}

export async function rememberEditToken(
  requestId: string,
  token: string | null | undefined,
): Promise<void> {
  if (!requestId || !token) return;
  try {
    await SecureStore.setItemAsync(keyFor(requestId), token);
  } catch {
    // Nothing to do: the notify panel falls back to asking the user to sign in.
  }
}

export async function readEditToken(requestId: string): Promise<string | null> {
  if (!requestId) return null;
  try {
    return await SecureStore.getItemAsync(keyFor(requestId));
  } catch {
    return null;
  }
}

export async function forgetEditToken(requestId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(keyFor(requestId));
  } catch {
    // nothing to do
  }
}
