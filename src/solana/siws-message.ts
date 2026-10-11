/**
 * The Sign-In-With-Solana message, built on this phone.
 *
 * WHY THIS FILE EXISTS. The first sign-in path hands MWA a `sign_in_payload`
 * and the WALLET builds the message text. On a real Seeker (2026-09-18) that
 * authorize call failed outright ("-1 / authorization request failed"), while
 * the same authorize without `sign_in_payload` succeeded — so the app needs a
 * second path that authorizes plainly, builds the text itself, and asks the
 * wallet only to `signMessages` it. That text has to parse on the server, so
 * everything here is a line-for-line port of `buildSiwsMessage()` in
 * `web/src/lib/siws.ts`, which is itself `createSignInMessageText` from
 * `@solana/wallet-standard-util`.
 *
 * WHAT THE SERVER REQUIRES (web/src/lib/siws.ts `verifySiws`, read
 * 2026-09-18), because every one of these is a way to fail:
 *
 *   - the first line must be exactly `${domain} wants you to sign in with your
 *     Solana account:` and the second line the base58 address;
 *   - `domain` must be in `allowedSiwsDomains()`, which is
 *     `DEFAULT_SIWS_DOMAINS = ["avoid.net", "www.avoid.net"]` plus whatever
 *     `SIWS_ALLOWED_DOMAINS` adds. We use `www.avoid.net`: it is in the
 *     default list, so no server env var has to be set for this to work;
 *   - `Version:` is REQUIRED — `parseSiwsMessage` returns null without it,
 *     which the route reports as `malformed`;
 *   - `Issued At` is REQUIRED and must be within ten minutes
 *     (`DEFAULT_SIWS_MAX_AGE_MS`), with two minutes of clock skew allowed in
 *     either direction. So the message is built at the moment of signing, and
 *     `PATCH /api/me` has to follow within that window;
 *   - the address in the message must equal the `wallet_pubkey` on the PATCH
 *     body exactly, trimmed;
 *   - the signature may be base64 or base58, discriminated by decoding to 64
 *     bytes. We send base64.
 *
 * `Chain ID` is NOT checked by the server. It is `mainnet` (not
 * `mainnet-beta`) because that is the value Supabase's Web3 provider expects
 * in a SIWS message, and Supabase verifies the same text.
 */

/** In `DEFAULT_SIWS_DOMAINS`, so no server env var is needed. Bare host, no scheme, no path. */
export const SIWS_DOMAIN = "www.avoid.net";

/** Absolute https URL whose host is `SIWS_DOMAIN`. */
export const SIWS_URI = "https://www.avoid.net";

/** EIP-4361 / SIWS version. The server rejects a message without it. */
export const SIWS_VERSION = "1";

/**
 * SIWS chain id. Supabase Auth only accepts `solana:(main|dev|test|local)net`
 * (`validSolanaNetworksPattern` in supabase/auth internal/utilities/siws) and
 * answers anything else, including a bare `mainnet`, with "Chain ID is not
 * valid". That was every wallet sign-in on the Seeker on 2026-10-03, on both
 * paths. Not `mainnet-beta` either. The web verifier accepts any value.
 */
export const SIWS_CHAIN_ID = "solana:mainnet";

/**
 * DESIGN.md §5 voice: plain English, second person, no exclamation points.
 * Must not contain a blank line: the server's statement group is a lazy match
 * that ends at the first newline pair, so a paragraph break here would push
 * the rest of the statement into the fields block and fail the parse.
 */
export const SIWS_STATEMENT =
  "Sign in to AVOID.NET with this wallet. This proves you control the address; it does not approve any transaction.";

/** The fields a SIWS message carries. Names follow the wallet-standard input type. */
export type SiwsFields = {
  domain: string;
  address: string;
  statement?: string;
  uri?: string;
  version: string;
  chainId?: string;
  nonce?: string;
  issuedAt?: string;
};

/**
 * 32 hex characters. SIWS wants an alphanumeric nonce of at least 8; this is
 * 16 random bytes from `react-native-get-random-values` (loaded in
 * polyfills.ts), which is the same source the countersign path uses.
 */
export function siwsNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The fields this app signs, for a given address, issued now. */
export function siwsFieldsFor(address: string, now: Date = new Date()): SiwsFields {
  return {
    domain: SIWS_DOMAIN,
    address,
    statement: SIWS_STATEMENT,
    uri: SIWS_URI,
    version: SIWS_VERSION,
    chainId: SIWS_CHAIN_ID,
    nonce: siwsNonce(),
    issuedAt: now.toISOString(),
  };
}

/**
 * Render the fields as the exact text the server's regex parses.
 *
 * Port of `buildSiwsMessage()` in web/src/lib/siws.ts — same order, same blank
 * lines, same `${key}: ${value}` spelling. Changing either side without the
 * other breaks sign-in with `malformed`.
 */
export function buildSiwsMessageText(fields: SiwsFields): string {
  let message = `${fields.domain} wants you to sign in with your Solana account:\n`;
  message += `${fields.address}`;
  if (fields.statement) message += `\n\n${fields.statement}`;

  const lines: string[] = [];
  if (fields.uri) lines.push(`URI: ${fields.uri}`);
  if (fields.version) lines.push(`Version: ${fields.version}`);
  if (fields.chainId) lines.push(`Chain ID: ${fields.chainId}`);
  if (fields.nonce) lines.push(`Nonce: ${fields.nonce}`);
  if (fields.issuedAt) lines.push(`Issued At: ${fields.issuedAt}`);
  if (lines.length) message += `\n\n${lines.join("\n")}`;
  return message;
}

/** The text this phone signs for `address`, and the fields it was built from. */
export function buildSiwsMessageFor(address: string): { text: string; fields: SiwsFields } {
  const fields = siwsFieldsFor(address);
  return { text: buildSiwsMessageText(fields), fields };
}
