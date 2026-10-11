/**
 * Reads the magic-link URL Supabase sends the user back to (`avoid://auth...`).
 *
 * Pure on purpose (no React Native, no Supabase import) so
 * tests/auth-link.test.mjs can run it under plain Node. Supabase can answer in
 * several shapes depending on the flow, and the same parser covers all of them:
 *
 *   PKCE            avoid://auth?code=<code>
 *   Implicit        avoid://auth#access_token=<jwt>&refresh_token=<token>&...
 *   Token hash      avoid://auth?token_hash=<hash>&type=magiclink|email
 *   Failure         avoid://auth?error=...&error_description=...
 *                   avoid://auth#error=access_denied&error_code=otp_expired&...
 *
 * The URL is split by hand rather than with `new URL()`: Hermes' URL is
 * incomplete, and a custom-scheme URL with a fragment is exactly where engines
 * disagree.
 */

const OTP_TYPES = ["magiclink", "email", "signup", "recovery", "invite", "email_change"] as const;
export type AuthOtpType = (typeof OTP_TYPES)[number];

export type AuthLink =
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "token_hash"; tokenHash: string; type: AuthOtpType }
  | { kind: "error"; message: string }
  | { kind: "none" };

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function parseParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = decode(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? "" : decode(pair.slice(eq + 1));
    if (key) out[key] = value;
  }
  return out;
}

/** True when the URL is aimed at the auth route (avoid://auth, avoid:///auth, avoid://auth/). */
export function isAuthLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^[a-z][a-z0-9+.-]*:\/{2,3}auth(?:[/?#]|$)/i.test(url);
}

export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url || !isAuthLink(url)) return { kind: "none" };

  const hashAt = url.indexOf("#");
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const fragment = hashAt === -1 ? "" : url.slice(hashAt + 1);
  const queryAt = beforeHash.indexOf("?");
  const query = queryAt === -1 ? "" : beforeHash.slice(queryAt + 1);

  // The fragment wins on a collision: it is where the implicit flow puts the
  // tokens and where Supabase puts errors for it.
  const params = { ...parseParams(query), ...parseParams(fragment) };

  if (params.error || params.error_code || params.error_description) {
    return { kind: "error", message: describeAuthError(params) };
  }
  if (params.access_token && params.refresh_token) {
    return { kind: "tokens", accessToken: params.access_token, refreshToken: params.refresh_token };
  }
  if (params.code) return { kind: "code", code: params.code };
  if (params.token_hash) {
    const type = (OTP_TYPES as readonly string[]).includes(params.type ?? "")
      ? (params.type as AuthOtpType)
      : "magiclink";
    return { kind: "token_hash", tokenHash: params.token_hash, type };
  }
  return { kind: "none" };
}

/** A sentence for the failure Supabase reported, never a raw code. */
export function describeAuthError(params: Record<string, string>): string {
  if (params.error_code === "otp_expired") {
    return "That sign-in link has expired or was already used. Request a new one from the Profile tab.";
  }
  const detail = params.error_description || params.error || "unknown error";
  return `Sign-in failed: ${detail}. Request a new link from the Profile tab.`;
}
