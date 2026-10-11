/**
 * Handle rules and failure words for creating an account from the app.
 *
 * Pure (no React Native, no fetch) so tests/handle.test.mjs runs it in Node.
 * The rule is `isValidHandle` in web/src/lib/auth-client.ts; the answers are
 * PATCH /api/me in web/src/app/api/me/route.ts: 400 for a bad handle, 409
 * "Handle already taken", 500 with a raw database message otherwise.
 */

/** Same pattern as the server's isValidHandle: 3-32 of letters, digits, _ and -. */
export function isValidHandle(handle: string): boolean {
  return /^[a-zA-Z0-9_-]{3,32}$/.test(handle);
}

export const HANDLE_RULE = "3 to 32 characters, letters, numbers, dashes and underscores";

/** A person's words for a failed handle save. Never the server's code or database text. */
export function handleFailureMessage(status: number | null, code?: string | null): string {
  if (status === 409) return "That name is taken. Try another.";
  if (status === 400) return `That name is not allowed. Use ${HANDLE_RULE}.`;
  if (status === 0 || code === "network") return "The phone could not reach avoid.net. Try again.";
  if (status === 401 || code === "not_signed_in") return "You were signed out. Sign in again, then pick a name.";
  if (status === 429) return "You have hit the limit for now. Try again later.";
  return "Could not create your account just now. Try again in a minute.";
}
