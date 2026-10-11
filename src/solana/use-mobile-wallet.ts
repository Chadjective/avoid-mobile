/**
 * Mobile Wallet Adapter session.
 *
 * MWA has no long-lived connection: every privileged call opens a short
 * "scenario" with the wallet app via `transact()`, and the app remembers an
 * `auth_token` so the next one can `reauthorize` without another consent
 * screen. This hook holds that token plus the selected account, and exposes
 * the three things the rest of the app needs: connect, disconnect, and a
 * `withWallet()` escape hatch for anything that must run inside a session
 * (signing a message, signing and sending a transaction).
 *
 * MWA is Android-only by design; there is no iOS path (spec §2.3).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { transact, type Web3MobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import type {
  Account as MwaAccount,
  AuthorizationResult,
  AuthToken,
  SignInPayload,
} from "@solana-mobile/mobile-wallet-adapter-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CLUSTER, type ClusterId } from "./cluster";
import { mwaChain } from "./mwa-chain";
import { shortAddress, type SignInTrace } from "./sign-in-diagnostics";

/**
 * Shown by the wallet on the consent screen, and — the part that bites —
 * checked by it.
 *
 * `uri` MUST be an absolute https URL. A wallet that cannot resolve the
 * identity refuses the whole authorize request, and the only thing it reports
 * back is `-1 / authorization request failed`, which is what the first Seeker
 * test saw. `icon` is deliberately RELATIVE: the MWA spec resolves it against
 * `uri`, and an absolute icon URL is a second thing to get wrong.
 *
 * The SIWS `domain` (src/solana/siws-message.ts) is the BARE HOST of this URI
 * with no scheme and no path; `assertAppIdentity()` below keeps the two from
 * drifting apart, because a domain/uri mismatch is the other common cause of
 * that same opaque failure.
 */
export const APP_IDENTITY = {
  name: "AVOID.NET",
  uri: "https://www.avoid.net",
  icon: "favicon.ico",
} as const;

/** The bare host of `APP_IDENTITY.uri` — what SIWS calls `domain`. */
export const APP_IDENTITY_HOST = "www.avoid.net";

/**
 * Checked once at module load in a dev build. It cannot fail in a shipped
 * build (both values are literals above), which is the point: if someone edits
 * one of them, this says so on the laptop rather than on a stranger's phone.
 */
function assertAppIdentity(): void {
  if (!__DEV__) return;
  const uri = APP_IDENTITY.uri as string;
  if (!uri.startsWith("https://")) {
    console.error(`[mwa] APP_IDENTITY.uri must be an absolute https URL, got ${uri}`);
  }
  const host = uri.replace(/^https:\/\//, "").replace(/\/.*$/, "");
  if (host !== APP_IDENTITY_HOST) {
    console.error(
      `[mwa] APP_IDENTITY.uri host (${host}) and the SIWS domain (${APP_IDENTITY_HOST}) disagree.`,
    );
  }
}
assertAppIdentity();

const AUTH_TOKEN_KEY = "avoid.mwa.auth_token";
const ADDRESS_KEY = "avoid.mwa.address";

export type ConnectedWallet = {
  /** Base58 public key — what every AVOID.NET surface displays and stores. */
  address: string;
  /**
   * The same key base64-encoded, which is the ONLY spelling MWA's
   * `signMessages({addresses})` accepts. Kept alongside rather than
   * re-derived at each call site, because sending base58 there fails with a
   * protocol error that reads like a declined signature.
   */
  addressBase64: string;
  publicKey: PublicKey;
  label?: string;
};

/** MWA returns account addresses base64-encoded; AVOID.NET speaks base58. */
export function accountToWallet(account: MwaAccount): ConnectedWallet {
  const bytes = Uint8Array.from(Buffer.from(account.address, "base64"));
  const publicKey = new PublicKey(bytes);
  const label = "label" in account ? account.label : undefined;
  return {
    address: publicKey.toBase58(),
    addressBase64: account.address,
    publicKey,
    label: label ?? undefined,
  };
}

export type MobileWalletState = {
  wallet: ConnectedWallet | null;
  connecting: boolean;
  error: Error | null;
  cluster: ClusterId;
  connect: () => Promise<ConnectedWallet>;
  disconnect: () => Promise<void>;
  /**
   * Run `callback` inside an MWA session that is already authorized (it
   * reauthorizes with the stored token when there is one). Use for
   * `signMessages` and `signAndSendTransactions`.
   */
  withWallet: <T>(callback: (wallet: Web3MobileWallet, account: ConnectedWallet) => Promise<T>) => Promise<T>;
};

export function useMobileWallet(cluster: ClusterId = DEFAULT_CLUSTER): MobileWalletState {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Restore the last session so a returning user sees their address without a
  // wallet round-trip. The token is only proven good on the next transact().
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [token, address] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(ADDRESS_KEY),
        ]);
        if (cancelled || !token || !address) return;
        const publicKey = new PublicKey(address);
        setAuthToken(token);
        setWallet({
          address,
          addressBase64: Buffer.from(publicKey.toBytes()).toString("base64"),
          publicKey,
        });
      } catch {
        // A corrupt cache is not worth failing the app over.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback(async (result: AuthorizationResult) => {
    const account = result.accounts[0];
    if (!account) throw new Error("The wallet authorized no accounts.");
    const next = accountToWallet(account);
    setWallet(next);
    setAuthToken(result.auth_token);
    await AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, result.auth_token],
      [ADDRESS_KEY, next.address],
    ]);
    return next;
  }, []);

  const connect = useCallback(async (): Promise<ConnectedWallet> => {
    setConnecting(true);
    setError(null);
    try {
      const result = await transact(async (mobileWallet) =>
        mobileWallet.authorize({
          identity: APP_IDENTITY,
          chain: mwaChain(cluster),
          auth_token: authToken ?? undefined,
        }),
      );
      return await remember(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [authToken, cluster, remember]);

  const disconnect = useCallback(async () => {
    const token = authToken;
    setWallet(null);
    setAuthToken(null);
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, ADDRESS_KEY]);
    if (!token) return;
    try {
      await transact(async (mobileWallet) => mobileWallet.deauthorize({ auth_token: token }));
    } catch {
      // The local session is already gone; a wallet that refuses to
      // deauthorize must not leave the app looking signed in.
    }
  }, [authToken]);

  const withWallet = useCallback(
    async <T,>(
      callback: (mobileWallet: Web3MobileWallet, account: ConnectedWallet) => Promise<T>,
    ): Promise<T> => {
      return transact(async (mobileWallet) => {
        const result = await mobileWallet.authorize({
          identity: APP_IDENTITY,
          chain: mwaChain(cluster),
          auth_token: authToken ?? undefined,
        });
        const account = await remember(result);
        return callback(mobileWallet, account);
      });
    },
    [authToken, cluster, remember],
  );

  return useMemo(
    () => ({ wallet, connecting, error, cluster, connect, disconnect, withWallet }),
    [wallet, connecting, error, cluster, connect, disconnect, withWallet],
  );
}

/**
 * Authorize with a Sign-In-With-Solana payload attached, so consent and proof
 * of ownership happen in one wallet round-trip. The FIRST thing
 * signInWithSolana() tries.
 */
export async function authorizeWithSignIn(params: {
  cluster: ClusterId;
  authToken?: AuthToken | null;
  signInPayload: SignInPayload;
  trace?: SignInTrace;
}): Promise<AuthorizationResult> {
  if (params.trace) params.trace.step = "authorize";
  return transact(async (mobileWallet) => {
    const result = await mobileWallet.authorize({
      identity: APP_IDENTITY,
      chain: mwaChain(params.cluster),
      auth_token: params.authToken ?? undefined,
      sign_in_payload: params.signInPayload,
    });
    noteAuthorization(params.trace, result);
    return result;
  });
}

/** Record what the wallet told us about itself, for the failure details. */
function noteAuthorization(trace: SignInTrace | undefined, result: AuthorizationResult): void {
  if (!trace) return;
  trace.walletUriBase = result.wallet_uri_base ?? null;
  const account = result.accounts[0];
  if (account) {
    trace.walletLabel = ("label" in account ? account.label : null) ?? null;
    try {
      trace.address = shortAddress(accountToWallet(account).address);
    } catch {
      // A malformed address is reported by the caller; it is not this note's job.
    }
  }
  trace.gotSignInResult = Boolean(result.sign_in_result);
}

/**
 * Authorize WITHOUT a sign-in payload, then ask the wallet to sign a message
 * this app built. The fallback path: on the first Seeker test, authorize with
 * `sign_in_payload` failed and authorize without it succeeded, so the two
 * capabilities have to be separable.
 *
 * `buildMessage` is a callback rather than a string because the message names
 * the address, and the address is only known once the wallet has answered —
 * and because `Issued At` must be minted inside the ten-minute window the
 * server enforces, not before the user has picked an account.
 */
export async function authorizeAndSignMessage(params: {
  cluster: ClusterId;
  authToken?: AuthToken | null;
  buildMessage: (wallet: ConnectedWallet) => string;
  trace?: SignInTrace;
}): Promise<{
  wallet: ConnectedWallet;
  authorization: AuthorizationResult;
  message: string;
  /** The 64 raw ed25519 bytes. */
  signature: Uint8Array;
}> {
  if (params.trace) params.trace.step = "authorize";
  return transact(async (mobileWallet) => {
    const authorization = await mobileWallet.authorize({
      identity: APP_IDENTITY,
      chain: mwaChain(params.cluster),
      auth_token: params.authToken ?? undefined,
    });
    noteAuthorization(params.trace, authorization);
    const account = authorization.accounts[0];
    if (!account) throw new Error("The wallet authorized no accounts.");
    const wallet = accountToWallet(account);

    const message = params.buildMessage(wallet);
    const payload = Uint8Array.from(Buffer.from(message, "utf8"));
    if (params.trace) params.trace.step = "sign_message";
    const signed = await mobileWallet.signMessages({
      // Base64, not base58: this is the address exactly as the wallet gave it.
      addresses: [wallet.addressBase64],
      payloads: [payload],
    });

    const signedPayload = signed[0];
    if (!signedPayload) throw new Error("The wallet returned no signed message.");
    return {
      wallet,
      authorization,
      message,
      signature: extractSignature(signedPayload, payload.length),
    };
  });
}

/**
 * MWA's `sign_messages` returns the SIGNED PAYLOAD, which for an off-chain
 * message is the message bytes with the 64-byte signature appended — not the
 * signature on its own. Slicing the tail is therefore the normal case; a bare
 * 64-byte answer is accepted too, because a wallet that returns just the
 * signature is a difference we can absorb rather than a failure.
 */
function extractSignature(signedPayload: Uint8Array, messageLength: number): Uint8Array {
  const SIGNATURE_LENGTH = 64;
  if (signedPayload.length === messageLength + SIGNATURE_LENGTH) {
    return signedPayload.slice(messageLength);
  }
  if (signedPayload.length === SIGNATURE_LENGTH) return signedPayload;
  throw new Error(
    `The wallet returned a ${signedPayload.length}-byte signed payload; expected ${
      messageLength + SIGNATURE_LENGTH
    } (message + signature) or ${SIGNATURE_LENGTH} (signature only).`,
  );
}
