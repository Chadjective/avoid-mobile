/**
 * One place that knows who the user is.
 *
 * ONE DEFINITION OF SIGNED IN: a Supabase session exists. Nothing else counts.
 * A connected wallet is an MWA authorization and nothing more — the first
 * device test (2026-09-18) had the owner read a connected wallet as "signed
 * in" and then meet sign-in prompts on every other tab, because the two states
 * were both rendered as identity. They are tracked separately here and the UI
 * is required to say which it has: `signedIn` is the only thing screens may
 * gate on.
 *
 * Sign in with Solana produces both at once (D3); a magic-link user has a
 * session and no wallet; "Connect wallet only" produces a wallet and no
 * session.
 *
 * AFTER a wallet sign-in the proof is spent a second time, on
 * `PATCH /api/me {wallet_pubkey, siws_message, siws_signature}` — the only
 * route that writes `accounts.wallet_verified_at` and the one that runs the
 * Seeker Genesis Token and SKR reads (web/src/app/api/me/route.ts). Without
 * that call the Supabase session exists but the server never learns the wallet,
 * so the Seeker pill, the SKR tier and countersigning all stay dark. The
 * server's ten-minute freshness window (web/src/lib/siws.ts) is why it happens
 * immediately rather than lazily.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured, missingSupabaseKeys } from "../api/supabase";
import { getMe, linkWallet as linkWalletRequest, updateMe } from "../api/me";
import { handleFailureMessage, isValidHandle } from "./handle";
import type { Me } from "../api/types";
import { ApiError } from "../api/client";
import {
  SignInFailure,
  describeWalletFailure,
  detailsText,
  failureWithDetails,
  proveWalletOwnership,
  signInWithEmail as siwsSignInWithEmail,
  signInWithSolana,
  signOut as supabaseSignOut,
} from "../solana/sign-in-with-solana";
import type { SignInTrace } from "../solana/sign-in-diagnostics";
import { useMobileWallet, type ConnectedWallet } from "../solana/use-mobile-wallet";
import { DEFAULT_CLUSTER } from "../solana/cluster";
import type { Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { resetWatchlist } from "../retention/watchlist-store";
import { resetImpactLedger } from "../retention/ImpactLedger";
import { resetScanHistory } from "../retention/scan-history";

/** Whose watchlist the shared store holds (src/retention/watchlist-store.ts). */
let watchlistOwner: string | null = null;

/** The SIWS triple, held only long enough to finish a wallet link. */
type WalletProof = {
  wallet_pubkey: string;
  siws_message: string;
  siws_signature: string;
};

export type SessionState = {
  /** True until the stored session has been read back. */
  loading: boolean;
  configured: boolean;
  /** The EXPO_PUBLIC_* names this build was compiled without. */
  missingKeys: string[];
  session: Session | null;
  /** The one definition. Screens gate on this and nothing else. */
  signedIn: boolean;
  /**
   * Definitely signed out: the stored session has been read back and there is
   * none. Sign-in prompts gate on this, not on `!signedIn`, which is also true
   * for the moment before the stored session loads and would flash the prompt
   * at a signed-in user on every cold start.
   */
  signedOut: boolean;
  me: Me | null;
  wallet: ConnectedWallet | null;
  connecting: boolean;
  /** Always a sentence, never a protocol code. */
  error: string | null;
  /**
   * Copyable failure details (step, raw code, wallet facts, app version) for
   * the failure in `error`, or null when there are none. No secrets.
   */
  errorDetails: string | null;
  /**
   * A wallet proved itself and Supabase issued a session, but the server has
   * no `accounts` row for it yet and wants a handle. Profile asks inline; the
   * proof is held until `finishSignUp` spends it.
   */
  needsHandle: boolean;
  signInWithWallet: () => Promise<void>;
  /** Resolves true when the link was sent; failures land in `error`. */
  signInWithEmail: (email: string) => Promise<boolean>;
  connectWallet: () => Promise<void>;
  /** Prove and link the wallet for an account that is already signed in. */
  linkWallet: () => Promise<void>;
  /** Spend the held proof with a handle, creating the account row. */
  finishSignUp: (handle: string) => Promise<void>;
  /**
   * Email sign-up: PATCH /api/me {handle} creates the accounts row for a
   * signed-in user who has none, then refreshes `me`. Failures land in `error`
   * as plain sentences, never as server codes.
   */
  createHandle: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /**
   * Run something inside an authorized MWA session — signing a message,
   * signing and sending a transaction. Exposed here rather than having each
   * screen call `useMobileWallet()` again, so there is one auth token and one
   * selected account in the app, not one per screen (D5's countersign is the
   * first caller).
   */
  withWallet: <T>(
    callback: (wallet: Web3MobileWallet, account: ConnectedWallet) => Promise<T>,
  ) => Promise<T>;
};

const Context = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const value = useContext(Context);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsHandle, setNeedsHandle] = useState(false);

  // Not state: nothing renders it, and it must survive a re-render without
  // one. It is dropped as soon as it is spent or the user signs out.
  const pendingProof = useRef<WalletProof | null>(null);

  const mobileWallet = useMobileWallet(DEFAULT_CLUSTER);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      // A different person (or nobody) now: drop the shared watchlist so the
      // next account never sees the last one's follows. Keyed on the user id,
      // not the event, because token refreshes re-fire SIGNED_IN and each
      // reset would cost a fresh GET /api/v1/watchlist.
      const userId = next?.user?.id ?? null;
      if (userId !== watchlistOwner) {
        // null → first user is not a switch: whatever the store holds was
        // loaded for this session already (getSession can beat this event).
        if (watchlistOwner !== null) resetWatchlist();
        // The ledger's cache is cheap to rebuild, so any change clears it —
        // including signed-out → signed-in, whose "device" rows differ.
        resetImpactLedger();
        resetScanHistory();
        watchlistOwner = userId;
      }
      setSession(next);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [configured]);

  /**
   * Reads `/api/me`. It does not close over `session`, because the wallet path
   * needs to call it the instant Supabase issues a token — before React has
   * re-rendered with it. `apiRequest(auth:"required")` throws before the fetch
   * when there is no token, so a signed-out call costs no Vercel invocation.
   */
  const refreshMe = useCallback(async () => {
    try {
      setMe(await getMe());
    } catch (err) {
      // 401 (or no token at all) means signed out or the account row is gone;
      // anything else is transient and must not log the user out.
      if (err instanceof ApiError && (err.isUnauthorized || err.code === "not_signed_in")) {
        setMe(null);
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [session, refreshMe]);

  /** Runs fn with the busy flag and error capture. Resolves true on success. */
  const guardOk = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setErrorDetails(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(plainWords(err));
      setErrorDetails(detailsText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  const guard = useCallback(
    async (fn: () => Promise<void>): Promise<void> => {
      await guardOk(fn);
    },
    [guardOk],
  );

  /**
   * Spend a SIWS proof on PATCH /api/me. A wallet-first user has no `accounts`
   * row, and the route answers 400 "handle required" rather than inventing a
   * name — so the proof is parked and Profile asks for one inline.
   */
  const spendProof = useCallback(
    async (proof: WalletProof, handle?: string) => {
      try {
        await linkWalletRequest({ ...proof, ...(handle ? { handle } : {}) });
        pendingProof.current = null;
        setNeedsHandle(false);
      } catch (err) {
        // "handle required" on a call that sent none is not an error the owner
        // can read as one — it is the sign-up step. A rejected handle IS an
        // error, so only the first case parks the proof.
        const wantsHandle =
          !handle && err instanceof ApiError && err.status === 400 && /handle required/i.test(err.message);
        if (wantsHandle) {
          pendingProof.current = proof;
          setNeedsHandle(true);
          return;
        }
        throw err;
      } finally {
        await refreshMe();
      }
    },
    [refreshMe],
  );

  const value: SessionState = useMemo(
    () => ({
      loading,
      configured,
      missingKeys: missingSupabaseKeys(),
      session,
      signedIn: session !== null,
      signedOut: !loading && session === null,
      me,
      wallet: mobileWallet.wallet,
      connecting: busy || mobileWallet.connecting,
      errorDetails: error ? errorDetails : null,
      error: error ?? (mobileWallet.error ? describeWalletFailure(mobileWallet.error).message : null),
      needsHandle,
      signInWithWallet: () =>
        guard(async () => {
          const result = await signInWithSolana(DEFAULT_CLUSTER);
          try {
            await spendProof({
              wallet_pubkey: result.wallet.address,
              siws_message: result.message,
              siws_signature: result.signatureBase64,
            });
          } catch (err) {
            throw linkFailure(err, result.trace);
          }
        }),
      signInWithEmail: (email: string) =>
        guardOk(async () => {
          await siwsSignInWithEmail(email);
        }),
      connectWallet: () =>
        guard(async () => {
          try {
            await mobileWallet.connect();
          } catch (err) {
            console.warn("[mwa] connect failed:", err);
            throw failureWithDetails(err, { path: "sign_message", step: "authorize" });
          }
        }),
      linkWallet: () =>
        guard(async () => {
          const proof = await proveWalletOwnership(DEFAULT_CLUSTER);
          try {
            await spendProof({
              wallet_pubkey: proof.wallet.address,
              siws_message: proof.message,
              siws_signature: proof.signatureBase64,
            });
          } catch (err) {
            throw linkFailure(err, proof.trace);
          }
        }),
      finishSignUp: (handle: string) =>
        guard(async () => {
          const proof = pendingProof.current;
          if (!proof) {
            await refreshMe();
            return;
          }
          await spendProof(proof, handle.trim());
        }),
      createHandle: (handle: string) =>
        guard(async () => {
          const wanted = handle.trim();
          if (!isValidHandle(wanted)) throw new Error(handleFailureMessage(400));
          try {
            await updateMe({ handle: wanted });
          } catch (err) {
            if (err instanceof ApiError) throw new Error(handleFailureMessage(err.status, err.code));
            throw new Error(handleFailureMessage(null));
          }
          await refreshMe();
        }),
      signOut: () =>
        guard(async () => {
          await mobileWallet.disconnect();
          if (configured) await supabaseSignOut();
          pendingProof.current = null;
          setNeedsHandle(false);
          setMe(null);
        }),
      refreshMe,
      withWallet: mobileWallet.withWallet,
    }),
    [
      loading,
      configured,
      session,
      me,
      mobileWallet,
      busy,
      error,
      errorDetails,
      guard,
      guardOk,
      refreshMe,
      needsHandle,
      spendProof,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * A failure of the step AFTER the wallet signed: `PATCH /api/me`, the server
 * checking the proof. Carries the wallet's trace so the details show that the
 * wallet part worked and the server part did not.
 */
function linkFailure(err: unknown, trace: SignInTrace): SignInFailure {
  if (err instanceof SignInFailure) return err;
  const failure = new SignInFailure(
    "server_rejected",
    plainWords(err),
    err instanceof ApiError ? `status ${err.status}` : null,
  );
  return failureWithDetails(err instanceof ApiError ? apiErrorForDetails(err) : err, {
    path: "link",
    step: "server_verify",
    trace,
    failure,
  });
}

/** An `ApiError` reduced to what is safe and useful in a bug report. */
function apiErrorForDetails(err: ApiError): Error {
  const reason =
    typeof err.body === "object" && err.body !== null && "reason" in err.body
      ? String((err.body as { reason: unknown }).reason)
      : "none";
  const e = new Error(`PATCH /api/me -> HTTP ${err.status}: ${err.message} (reason: ${reason})`);
  e.name = "ApiError";
  return e;
}

/**
 * The last stop before a string reaches the UI. `SignInFailure` already
 * carries a sentence; an `ApiError` from PATCH /api/me carries the route's
 * own words, which for a rejected proof is "Sign-in-with-Solana proof
 * rejected" plus a machine reason — that reason is expanded here rather than
 * shown as `domain_mismatch`.
 */
function plainWords(err: unknown): string {
  if (err instanceof SignInFailure) return err.message;

  if (err instanceof ApiError) {
    const reason = siwsReason(err.body);
    if (reason) return `Sign-in failed: ${reason}`;
    if (err.status === 409) return err.message;
    if (err.status === 0) return "No connection. Try again.";
    return err.message;
  }

  if (err instanceof Error) return err.message;
  return String(err);
}

/** The `reason` on a 400 from the wallet-link branch, in words. */
function siwsReason(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("reason" in body)) return null;
  const reason = (body as { reason: unknown }).reason;
  switch (reason) {
    case "bad_signature":
      return "the signature did not check out against that address.";
    case "address_mismatch":
      return "the wallet signed for a different address than it reported.";
    case "domain_mismatch":
      return "the message named a site the server does not accept.";
    case "expired":
      return "the signature took too long to arrive. Try again.";
    case "not_yet_valid":
      return "this phone's clock is ahead of the server's. Check the date and time.";
    case "malformed":
      return "the server could not read the message the wallet signed.";
    default:
      return null;
  }
}
