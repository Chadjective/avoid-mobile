/**
 * Sign in with Solana → an ordinary Supabase session.
 *
 * docs/MOBILE_APP_SPEC.md D3: the primary sign-in is the wallet. The app ends
 * up holding a normal Supabase JWT, so `/api/me`, `/api/submissions`,
 * `/api/scan` and `/api/requests` accept it through
 * `getCurrentAccountFromRequest()` with no mobile-specific server path.
 *
 * TWO PATHS, IN ORDER (2026-09-18, after the first Seeker test):
 *
 *   1. `authorize` with a `sign_in_payload`. One wallet round-trip for consent
 *      and proof; the wallet builds the SIWS text and returns it signed.
 *   2. If that throws, or comes back without a `sign_in_result`: `authorize`
 *      with no payload, build the SIWS text here
 *      (src/solana/siws-message.ts), and ask the wallet to `signMessages` it.
 *
 * The Seeker's wallet did (2) happily and refused (1) with
 * `-1 / authorization request failed` — MWA's `ERROR_AUTHORIZATION_FAILED`,
 * which is what a wallet reports for anything it will not do, including "I do
 * not implement solana:signInWithSolana". Path 1 stays first because it is one
 * prompt instead of two; path 2 is what actually works on that device.
 *
 * Either way the result is the same triple — message text, signature, address —
 * handed to Supabase Auth's Solana Web3 provider in its pre-signed form
 * (`{chain:'solana', message, signature}` rather than a `wallet` object). That
 * variant exists in @supabase/auth-js from 2.103.0 and this app resolves
 * 2.116.0. The same triple then goes to `PATCH /api/me`, which is the only
 * thing that writes `accounts.wallet_verified_at` (web/src/lib/siws.ts).
 *
 * NO RAW CODES IN THE SENTENCE. Everything thrown from here is a `SignInFailure`
 * whose `message` is a sentence the owner can act on. The protocol code, the
 * step that failed and the wallet's facts live in `diagnostic`, which Profile
 * offers behind a "Copy details" button (sign-in-diagnostics.ts).
 */
import { Buffer } from "buffer";
import type { Session } from "@supabase/supabase-js";
import type { SignInPayload } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { getSupabase, isSupabaseConfigured } from "../api/supabase";
import {
  accountToWallet,
  authorizeAndSignMessage,
  authorizeWithSignIn,
  type ConnectedWallet,
} from "./use-mobile-wallet";
import {
  SIWS_CHAIN_ID,
  SIWS_DOMAIN,
  SIWS_STATEMENT,
  SIWS_URI,
  SIWS_VERSION,
  buildSiwsMessageFor,
  siwsNonce,
} from "./siws-message";
import Constants from "expo-constants";
import { DEFAULT_CLUSTER, type ClusterId } from "./cluster";
import { mwaChain } from "./mwa-chain";
import {
  attemptFrom,
  errorCodeOf,
  formatDiagnostic,
  isNetworkFailureMessage,
  isUserCancelled,
  isWalletUnresponsive,
  WALLET_CANCELLED_MESSAGE,
  newTrace,
  type SignInAttempt,
  type SignInDiagnostic,
  type SignInStep,
  type SignInTrace,
} from "./sign-in-diagnostics";

export { WALLET_CANCELLED_MESSAGE };
export { SIWS_DOMAIN, SIWS_STATEMENT, SIWS_URI } from "./siws-message";

/** Which of the two paths produced the session. Logged, never shown. */
export type SignInPath = "sign_in_payload" | "sign_message";

export type SignInFailureKind =
  | "not_configured"
  | "no_wallet_app"
  | "wallet_declined"
  | "wallet_cancelled"
  | "wallet_unresponsive"
  | "server_rejected"
  | "network";

/**
 * A failure with a sentence attached. `message` is what Profile renders;
 * `detail` is the underlying code or provider message, for the console and a
 * bug report.
 */
export class SignInFailure extends Error {
  readonly kind: SignInFailureKind;
  readonly detail: string | null;
  /** Step, raw codes and wallet facts for the "Copy details" button. */
  diagnostic: SignInDiagnostic | null;

  constructor(
    kind: SignInFailureKind,
    message: string,
    detail: string | null = null,
    diagnostic: SignInDiagnostic | null = null,
  ) {
    super(message);
    this.name = "SignInFailure";
    this.kind = kind;
    this.detail = detail;
    this.diagnostic = diagnostic;
  }
}

/** The sentence shown when the wallet APP itself did not answer. */
export const WALLET_UNRESPONSIVE_MESSAGE =
  "Wallet app didn't respond. Open it once, then try again.";

/** The app version for a bug report. */
function appVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

/**
 * Attach a diagnostic to a failure. `err` is whatever was thrown (a wallet
 * error, an `ApiError`, a `SignInFailure`); `attempts` are earlier tries that
 * also failed. Returns the failure to throw. Never contains a signature or
 * token: see sign-in-diagnostics.ts `scrub`.
 */
export function failureWithDetails(
  err: unknown,
  opts: {
    path: SignInAttempt["path"];
    step: SignInStep;
    trace?: SignInTrace;
    attempts?: SignInAttempt[];
    cluster?: ClusterId;
    /** Sentence to show; defaults to the classified wallet failure's. */
    failure?: SignInFailure;
  },
): SignInFailure {
  const failure = opts.failure ?? describeWalletFailure(err);
  const trace = opts.trace ?? newTrace();
  trace.step = opts.step;
  failure.diagnostic = {
    attempts: [...(opts.attempts ?? []), attemptFrom(err, opts.path, opts.step)],
    trace,
    appVersion: appVersion(),
    chain: mwaChain(opts.cluster ?? DEFAULT_CLUSTER),
    domain: SIWS_DOMAIN,
    at: new Date().toISOString(),
  };
  return failure;
}

/** The copyable text for a failure, or null when it carries none. */
export function detailsText(err: unknown): string | null {
  if (!(err instanceof SignInFailure)) return null;
  // A cancel is not a failure: nothing to paste into a bug report.
  if (err.kind === "wallet_cancelled") return null;
  const parts = [
    err.diagnostic ? formatDiagnostic(err.diagnostic) : null,
    err.detail ? `error: ${err.detail}` : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join("\n") : null;
}

export type SignInResult = {
  session: Session;
  wallet: ConnectedWallet;
  /** The exact UTF-8 text that was signed — `siws_message` on PATCH /api/me. */
  message: string;
  /** Base64, which web/src/lib/siws.ts `decodeSignature` accepts. */
  signatureBase64: string;
  path: SignInPath;
  /** How far the wallet got, for a later failure (the PATCH /api/me step). */
  trace: SignInTrace;
};

/**
 * The payload handed to the wallet on the first attempt.
 *
 * `domain` is a BARE HOST — no scheme, no path, no port — and `uri` is the
 * absolute https URL whose host it is. A wallet that cannot reconcile the two,
 * or that is handed `https://www.avoid.net` as the domain, refuses the
 * authorization without saying why.
 */
export function buildSignInPayload(): SignInPayload {
  return {
    domain: SIWS_DOMAIN,
    uri: SIWS_URI,
    statement: SIWS_STATEMENT,
    version: SIWS_VERSION,
    chainId: SIWS_CHAIN_ID,
    nonce: siwsNonce(),
    issuedAt: new Date().toISOString(),
  };
}

/**
 * Sign in. Tries the one-prompt path, falls back to authorize + signMessages.
 *
 * Throws only `SignInFailure`.
 */
export async function signInWithSolana(
  cluster: ClusterId = DEFAULT_CLUSTER,
): Promise<SignInResult> {
  if (!isSupabaseConfigured()) {
    throw new SignInFailure(
      "not_configured",
      "This build can't sign in.",
    );
  }

  const trace = newTrace();
  const attempts: SignInAttempt[] = [];

  // --- path 1: authorize + sign_in_payload ---------------------------------
  try {
    const authorization = await authorizeWithSignIn({
      cluster,
      signInPayload: buildSignInPayload(),
      trace,
    });
    const signIn = authorization.sign_in_result;
    const account = authorization.accounts[0];

    if (signIn && account) {
      // MWA base64-encodes both the message it signed and the signature.
      const message = Buffer.from(signIn.signed_message, "base64").toString("utf8");
      trace.signedMessage = message;
      trace.step = "server_verify";
      const session = await exchangeWithSupabase(message, signIn.signature);
      console.log("[siws] signed in via sign_in_payload");
      return {
        session,
        wallet: accountToWallet(account),
        message,
        signatureBase64: signIn.signature,
        path: "sign_in_payload",
        trace,
      };
    }

    attempts.push({
      path: "sign_in_payload",
      step: "authorize",
      errorName: null,
      code: null,
      message: "Wallet authorized but returned no sign_in_result (no solana:signInWithSolana support).",
    });
  } catch (err) {
    // Supabase said no: not a wallet problem, and a second signature would
    // fail the same way.
    if (err instanceof SignInFailure) {
      throw failureWithDetails(err, {
        path: "sign_in_payload",
        step: "server_verify",
        trace,
        attempts,
        cluster,
        failure: err,
      });
    }
    attempts.push(attemptFrom(err, "sign_in_payload", trace.step));
    // The person said no in the wallet: do not open it again for path 2.
    if (isUserCancelled(err)) {
      throw failureWithDetails(err, {
        path: "sign_in_payload",
        step: trace.step,
        trace,
        attempts: attempts.slice(0, -1),
        cluster,
        failure: describeWalletFailure(err),
      });
    }
    // The wallet app itself failed (session closed / timed out). Opening it a
    // second time in the same breath only doubles the crash; stop and say so.
    if (isWalletUnresponsive(err)) {
      console.warn("[siws] wallet app did not respond:", err);
      throw failureWithDetails(err, {
        path: "sign_in_payload",
        step: trace.step,
        trace,
        attempts: attempts.slice(0, -1),
        cluster,
      });
    }
    console.warn("[siws] sign_in_payload path failed, falling back to signMessages:", err);
  }

  // --- path 2: authorize, build the message here, signMessages -------------
  // ONE transact() session covers authorize AND signMessages, so the second
  // call rides the first call's authorization: no separate session, no token.
  let signed: Awaited<ReturnType<typeof authorizeAndSignMessage>>;
  try {
    signed = await authorizeAndSignMessage({
      cluster,
      trace,
      buildMessage: (wallet) => buildSiwsMessageFor(wallet.address).text,
    });
  } catch (err) {
    console.warn("[siws] signMessages fallback failed:", err);
    throw failureWithDetails(err, {
      path: "sign_message",
      step: trace.step,
      trace,
      attempts,
      cluster,
    });
  }

  const signatureBase64 = Buffer.from(signed.signature).toString("base64");
  trace.signedMessage = signed.message;
  trace.step = "server_verify";
  let session: Session;
  try {
    session = await exchangeWithSupabase(signed.message, signatureBase64);
  } catch (err) {
    throw failureWithDetails(err, {
      path: "sign_message",
      step: "server_verify",
      trace,
      attempts,
      cluster,
      failure: err instanceof SignInFailure ? err : undefined,
    });
  }
  console.log("[siws] signed in via authorize + signMessages fallback");
  return {
    session,
    wallet: signed.wallet,
    message: signed.message,
    signatureBase64,
    path: "sign_message",
    trace,
  };
}

/**
 * Prove ownership of the connected wallet WITHOUT signing in — for an account
 * that already has a Supabase session (an email-link user) and needs a wallet
 * linked to it. Same message, same signature, no Supabase exchange.
 */
export async function proveWalletOwnership(
  cluster: ClusterId = DEFAULT_CLUSTER,
): Promise<{ wallet: ConnectedWallet; message: string; signatureBase64: string; trace: SignInTrace }> {
  const trace = newTrace();
  let signed: Awaited<ReturnType<typeof authorizeAndSignMessage>>;
  try {
    signed = await authorizeAndSignMessage({
      cluster,
      trace,
      buildMessage: (wallet) => buildSiwsMessageFor(wallet.address).text,
    });
  } catch (err) {
    console.warn("[siws] wallet ownership proof failed:", err);
    throw failureWithDetails(err, { path: "sign_message", step: trace.step, trace, cluster });
  }
  return {
    trace,
    wallet: signed.wallet,
    message: signed.message,
    signatureBase64: Buffer.from(signed.signature).toString("base64"),
  };
}

/** Email magic link, the fallback for users with no wallet (D3). */
export async function signInWithEmail(email: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new SignInFailure(
      "not_configured",
      "This build can't sign in.",
    );
  }
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim(),
    // Deep link (scheme "avoid" in app.json), handled by app/auth.tsx. It must be in
    // Supabase Auth > URL Configuration > Redirect URLs, or Supabase ignores it and
    // falls back to the Site URL (the website). Web /auth/callback does NOT bounce
    // into the app; it serves the website only.
    options: { emailRedirectTo: "avoid://auth" },
  });
  if (error) {
    throw new SignInFailure(
      "server_rejected",
      "Couldn't send the link. Try again.",
      error.message,
    );
  }
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}

// ---------------------------------------------------------------------------

/**
 * Hand the pre-signed pair to Supabase. Supabase must have the Web3 (Solana)
 * provider enabled and `www.avoid.net` in its allowed domains; when it does
 * not, the rejection arrives here and is repeated verbatim after "Server
 * rejected the signature:", because that string is the only thing that tells
 * the owner which knob to turn.
 */
async function exchangeWithSupabase(message: string, signatureBase64: string): Promise<Session> {
  const send = () =>
    getSupabase().auth.signInWithWeb3({
      chain: "solana",
      message,
      signature: Uint8Array.from(Buffer.from(signatureBase64, "base64")),
    });
  let { data, error } = await send();
  // The phone dropped off the network for a moment (it happens right after the
  // hand-back from the wallet app). The signed message is good for minutes, so
  // try once more before asking the user to sign again.
  if (error && isNetworkFailureMessage(error.message)) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    ({ data, error } = await send());
    if (error && isNetworkFailureMessage(error.message)) {
      throw new SignInFailure(
        "network",
        "No connection. Check your network and try again.",
        error.message,
      );
    }
  }
  if (error) {
    throw new SignInFailure(
      "server_rejected",
      "Sign-in failed. Try again.",
      error.message,
    );
  }
  if (!data.session) {
    throw new SignInFailure(
      "server_rejected",
      "Sign-in failed. Try again.",
    );
  }
  return data.session;
}

/**
 * Turn whatever the wallet threw into one sentence.
 *
 * Every MWA refusal — a declined prompt, a closed session, a wallet that does
 * not implement a feature, `-1 / authorization request failed` — is the same
 * thing from the owner's side: the wallet did not sign. The only distinction
 * worth drawing is "there is no wallet app on this phone", because that has a
 * different remedy.
 *
 * Pure, so the session provider can call it while rendering. Callers log.
 */
export function describeWalletFailure(err: unknown): SignInFailure {
  if (err instanceof SignInFailure) return err;
  const detail = err instanceof Error ? `${errorCodeOf(err) ?? ""} ${err.message}`.trim() : String(err);

  if (isUserCancelled(err)) {
    return new SignInFailure("wallet_cancelled", WALLET_CANCELLED_MESSAGE, detail);
  }

  if (isWalletUnresponsive(err)) {
    return new SignInFailure("wallet_unresponsive", WALLET_UNRESPONSIVE_MESSAGE, detail);
  }

  if (errorCodeOf(err) === "ERROR_WALLET_NOT_FOUND") {
    return new SignInFailure(
      "no_wallet_app",
      "No Solana wallet found. Install one and try again.",
      detail,
    );
  }
  if (err instanceof Error && /network|timed out|timeout/i.test(err.message)) {
    return new SignInFailure(
      "network",
      "No connection. Try again.",
      detail,
    );
  }
  return new SignInFailure("wallet_declined", "Your wallet can't sign in with Solana. Try another wallet.", detail);
}
