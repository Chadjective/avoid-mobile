/**
 * What a failed wallet sign-in leaves behind for a bug report.
 *
 * The first two device tests ended in a sentence and nothing else, so the
 * next one had to be guessed at. This module turns a failure into (a) the step
 * that failed, (b) the raw code and message, (c) whatever the wallet told us
 * about itself, and (d) the app version, as plain text the owner can copy
 * from Profile and paste into a message.
 *
 * NO SECRETS. It never sees a signature, an auth token or the Supabase
 * session, and `scrub()` removes anything shaped like one from the provider
 * messages it does see (a long base58/base64 run, a JWT). The wallet address is
 * public but is shortened anyway; nobody needs it whole to read the failure.
 *
 * Pure: no React Native imports, so `npm run test:logic` covers it.
 */

/** Where in the flow it broke. */
export type SignInStep =
  | "authorize" // opening the wallet / the wallet's consent screen
  | "sign_message" // the wallet's "sign this message" prompt
  | "server_verify" // Supabase (or PATCH /api/me) checking the signature
  | "unknown";

export const STEP_LABEL: Record<SignInStep, string> = {
  authorize: "1 connect / authorize (wallet app)",
  sign_message: "2 sign message (wallet app)",
  server_verify: "3 server verification (avoid.net / Supabase)",
  unknown: "unknown",
};

/** One thing that was tried and how it ended. */
export type SignInAttempt = {
  path: "sign_in_payload" | "sign_message" | "link";
  step: SignInStep;
  errorName: string | null;
  code: string | null;
  message: string;
};

/** Filled in while the flow runs, so a throw can say how far it got. */
export type SignInTrace = {
  step: SignInStep;
  /** `wallet_uri_base` from the authorize result: the only wallet identity MWA gives. */
  walletUriBase: string | null;
  /** The account `label` the wallet reported, when it did. */
  walletLabel: string | null;
  /** Did the wallet return a `sign_in_result`? null = authorize never returned. */
  gotSignInResult: boolean | null;
  /** Shortened address, when known. */
  address: string | null;
  /** The exact text the wallet signed, when it returned one (public: no secret in it). */
  signedMessage: string | null;
};

export function newTrace(): SignInTrace {
  return { step: "authorize", walletUriBase: null, walletLabel: null, gotSignInResult: null, address: null, signedMessage: null };
}

export type SignInDiagnostic = {
  attempts: SignInAttempt[];
  trace: SignInTrace;
  appVersion: string;
  chain: string;
  domain: string;
  at: string;
};

const MAX_MESSAGE = 400;

/** Strip anything that looks like a secret, and cap the length. */
export function scrub(text: string): string {
  return text
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, "[jwt removed]")
    .replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, "[long value removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE);
}

export function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 4)}...${address.slice(-4)}` : address;
}

/** `code` on both MWA error classes; a string on one, a number on the other. */
export function errorCodeOf(err: unknown): string | null {
  if (typeof err !== "object" || err === null || !("code" in err)) return null;
  const code = (err as { code: unknown }).code;
  return typeof code === "string" || typeof code === "number" ? String(code) : null;
}

function messageOf(err: unknown): string {
  return typeof err === "object" && err !== null && "message" in err
    ? String((err as { message: unknown }).message)
    : String(err);
}

export function attemptFrom(
  err: unknown,
  path: SignInAttempt["path"],
  step: SignInStep,
): SignInAttempt {
  const name =
    typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : null;
  return { path, step, errorName: name, code: errorCodeOf(err), message: scrub(messageOf(err)) };
}

/**
 * True when the wallet APP failed, as opposed to declining. On the Seeker the
 * founder saw Seed Vault itself say "Couldn't load your wallet"; what reaches
 * our code from that is a session that closed, timed out or never answered,
 * not a JSON-RPC refusal (`-1`, `-3`), which means the wallet ran and said no.
 */
export function isWalletUnresponsive(err: unknown): boolean {
  const code = errorCodeOf(err);
  if (
    code === "ERROR_SESSION_CLOSED" ||
    code === "ERROR_SESSION_TIMEOUT" ||
    code === "ERROR_ILLEGAL_TRANSPORT_STATE" ||
    code === "ERROR_ASSOCIATION_CANCELLED"
  ) {
    return true;
  }
  return /session (was )?closed|session timed out|not respond|unable to connect|connection (lost|closed|refused)|websocket|transport/i.test(
    messageOf(err),
  );
}

/**
 * True when a failure is the phone not reaching the server at all (no DNS, no
 * route, a timeout), as opposed to the server saying no. supabase-js reports
 * these as an error value whose message carries the platform's exception,
 * e.g. "fetch failed: java.net.UnknownHostException: Unable to resolve host"
 * (seen on a Seeker on Wi-Fi, 2026-10-03).
 */
/**
 * True when the person backed out in the wallet app ("Local association
 * cancelled by user", seen on a Seeker 2026-10-04). Opening the wallet a
 * second time for the fallback path then only asks the same question again.
 */
export function isUserCancelled(err: unknown): boolean {
  const code = errorCodeOf(err);
  // ERROR_NOT_SIGNED (-3) is MWA's "the user declined". A bare
  // ERROR_AUTHORIZATION_FAILED (-1) is NOT counted: wallets also use it for
  // "I cannot do sign-in-with-Solana", where the signMessages fallback helps.
  if (code === "ERROR_NOT_SIGNED" || code === "-3") return true;
  const text = err instanceof Error ? `${code ?? ""} ${err.message}` : String(err);
  return /cancell?ed by (the )?user|user (cancell?ed|canceled|rejected|declined|denied|refused|closed)|(request|authorization|sign\w*|connection|prompt) (was |been )?(declined|denied|rejected|cancell?ed|canceled)|rejected the request|declined the request|user declined/i.test(
    text,
  );
}

/**
 * The person backed out in the wallet. Not a failure: Profile shows this
 * sentence without the red "Copy details" button.
 */
export const WALLET_CANCELLED_MESSAGE =
  "You cancelled in the wallet app. Tap Sign in with Solana again when you are ready.";

export function isNetworkFailureMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  return /fetch failed|network request failed|UnknownHostException|Unable to resolve host|SocketTimeoutException|ConnectException|timed out|timeout|ENOTFOUND|ECONNRESET|ECONNREFUSED/i.test(
    text,
  );
}

export function formatDiagnostic(d: SignInDiagnostic): string {
  const t = d.trace;
  const lines: string[] = [
    "AVOID.NET wallet sign-in details",
    `app version: ${d.appVersion}`,
    `time: ${d.at}`,
    `chain sent to wallet: ${d.chain}`,
    `sign-in domain: ${d.domain}`,
    `wallet uri base: ${
      t.walletUriBase ??
      (t.gotSignInResult === null ? "(wallet never answered authorize)" : "(not reported by the wallet)")
    }`,
    `wallet account label: ${t.walletLabel ?? "(none)"}`,
  ];
  if (t.address) lines.push(`address: ${t.address}`);
  lines.push(
    `wallet returned sign_in_result: ${t.gotSignInResult === null ? "n/a" : t.gotSignInResult ? "yes" : "no"}`,
    `last step reached: ${STEP_LABEL[t.step]}`,
  );
  if (t.signedMessage) {
    lines.push(`signed message: ${JSON.stringify(t.signedMessage)}`);
  }
  d.attempts.forEach((a, i) => {
    lines.push(
      `attempt ${i + 1} (${a.path}) failed at ${STEP_LABEL[a.step]}: ` +
        `${a.errorName ?? "error"} code=${a.code ?? "none"} message="${a.message}"`,
    );
  });
  return lines.join("\n");
}
