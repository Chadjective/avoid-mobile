// Pure-logic tests for the wallet sign-in diagnostics (src/solana/mwa-chain.ts,
// sign-in-diagnostics.ts) and for the message the phone builds
// (src/solana/siws-message.ts). Run: npm run test:logic
import { test } from "node:test";
import assert from "node:assert/strict";
import { mwaChain } from "../src/solana/mwa-chain.ts";
import {
  scrub, isWalletUnresponsive, attemptFrom, formatDiagnostic, newTrace, shortAddress, isNetworkFailureMessage, isUserCancelled, WALLET_CANCELLED_MESSAGE,
} from "../src/solana/sign-in-diagnostics.ts";
import { buildSiwsMessageText, SIWS_CHAIN_ID } from "../src/solana/siws-message.ts";
import { signInActionLabel } from "../src/session/sign-in-action.ts";

test("the pinned sign-in button says which wallet it will use, and when it is waiting", () => {
  assert.equal(signInActionLabel({ connecting: false, walletConnected: false }), "Sign in with Solana");
  assert.equal(signInActionLabel({ connecting: false, walletConnected: true }), "Sign in with this wallet");
  assert.equal(signInActionLabel({ connecting: true, walletConnected: true }), "Waiting for wallet…");
  assert.equal(signInActionLabel({ connecting: true, walletConnected: false }), "Waiting for wallet…");
});

test("mwaChain never emits solana:mainnet-beta", () => {
  assert.equal(mwaChain("mainnet-beta"), "solana:mainnet");
  assert.equal(mwaChain("devnet"), "solana:devnet");
  assert.equal(mwaChain("testnet"), "solana:testnet");
});

test("wallet-app failures are told apart from a declined prompt", () => {
  assert.equal(isWalletUnresponsive(Object.assign(new Error("x"), { code: "ERROR_SESSION_CLOSED" })), true);
  assert.equal(isWalletUnresponsive(Object.assign(new Error("x"), { code: "ERROR_SESSION_TIMEOUT" })), true);
  assert.equal(isWalletUnresponsive(new Error("Session timed out")), true);
  assert.equal(isWalletUnresponsive(Object.assign(new Error("authorization request failed"), { code: -1 })), false);
  assert.equal(isWalletUnresponsive(Object.assign(new Error("declined"), { code: -3 })), false);
});

test("scrub removes long secrets and jwts, and caps length", () => {
  const sig = "A".repeat(88);
  assert.ok(!scrub(`bad ${sig} here`).includes(sig));
  assert.ok(!scrub("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk").includes("eyJ"));
  assert.ok(scrub("x ".repeat(1000)).length <= 400);
});

test("diagnostic text names step, code, version and no signature", () => {
  const trace = newTrace();
  trace.walletUriBase = "https://wallet.example";
  const a = attemptFrom(Object.assign(new Error("authorization request failed"), { code: -1 }), "sign_in_payload", "authorize");
  const text = formatDiagnostic({
    attempts: [a], trace, appVersion: "0.2.2", chain: "solana:mainnet", domain: "www.avoid.net", at: "2026-09-29T00:00:00Z",
  });
  assert.match(text, /app version: 0\.2\.2/);
  assert.match(text, /code=-1/);
  assert.match(text, /1 connect \/ authorize/);
  assert.match(text, /wallet uri base: https:\/\/wallet\.example/);
  assert.equal(shortAddress("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T"), "4Nd1...DB4T");
});

test("phone-built SIWS message has the shape the server regex needs", () => {
  const text = buildSiwsMessageText({
    domain: "www.avoid.net", address: "ADDR", statement: "Sign in.", uri: "https://www.avoid.net",
    version: "1", chainId: "solana:mainnet", nonce: "abcd1234abcd1234", issuedAt: "2026-09-29T00:00:00.000Z",
  });
  assert.equal(
    text,
    "www.avoid.net wants you to sign in with your Solana account:\nADDR\n\nSign in.\n\nURI: https://www.avoid.net\nVersion: 1\nChain ID: solana:mainnet\nNonce: abcd1234abcd1234\nIssued At: 2026-09-29T00:00:00.000Z",
  );
});

test("SIWS chain id is one Supabase Auth accepts", () => {
  // Copied from supabase/auth internal/utilities/siws/helpers.go
  // (validSolanaNetworksPattern). A bare "mainnet" fails with "Chain ID is not valid".
  assert.match(SIWS_CHAIN_ID, /^solana:(main|dev|test|local)net$/);
});

test("network failures are told apart from server refusals", () => {
  assert.equal(
    isNetworkFailureMessage(
      'fetch failed: java.net.UnknownHostException: Unable to resolve host "x.supabase.co": No address associated with hostname',
    ),
    true,
  );
  assert.equal(isNetworkFailureMessage("Network request failed"), true);
  assert.equal(isNetworkFailureMessage("siws: Chain ID is not valid"), false);
  assert.equal(isNetworkFailureMessage(null), false);
});

test("details include the signed message and do not claim the wallet never answered", () => {
  const trace = newTrace();
  trace.gotSignInResult = true;
  trace.signedMessage = "www.avoid.net wants you to sign in with your Solana account:\nADDR";
  trace.step = "server_verify";
  const text = formatDiagnostic({
    attempts: [], trace, appVersion: "0.2.3", chain: "solana:mainnet", domain: "www.avoid.net", at: "2026-10-03T00:00:00Z",
  });
  assert.match(text, /wallet uri base: \(not reported by the wallet\)/);
  assert.match(text, /signed message: "www\.avoid\.net wants you to sign in/);
});

test("a cancel in the wallet app is recognised, so the wallet is not opened twice", () => {
  const e = new Error("Local association cancelled by user");
  e.code = "Session not established: Local association cancelled by user";
  assert.equal(isUserCancelled(e), true);
  assert.equal(isUserCancelled(new Error("authorization request failed")), false);
});

test("a cancel at the connect step or in Phantom's own words is a cancel, not a failure", () => {
  for (const msg of [
    "User rejected the request",
    "Authorization request declined",
    "The user declined the request",
    "Sign message request was denied",
    "Local association cancelled by user",
  ]) {
    assert.equal(isUserCancelled(new Error(msg)), true, msg);
  }
  const notSigned = new Error("not signed");
  notSigned.code = "ERROR_NOT_SIGNED";
  assert.equal(isUserCancelled(notSigned), true);
  const authFailed = new Error("authorization request failed");
  authFailed.code = "ERROR_AUTHORIZATION_FAILED";
  assert.equal(isUserCancelled(authFailed), false);
  assert.equal(isUserCancelled(new Error("Wallet app crashed")), false);
});

test("the cancel sentence is the friendly one from the device test doc", () => {
  assert.equal(
    WALLET_CANCELLED_MESSAGE,
    "You cancelled in the wallet app. Tap Sign in with Solana again when you are ready.",
  );
});

test("an already-published page offers a link to it; a draft does not", async () => {
  const { requestExistsOutcome, DRAFT_MESSAGE } = await import("../src/session/request-outcome.ts");
  assert.deepEqual(requestExistsOutcome({ slug: "usd-coin", message: "Investigation already published." }), {
    note: "Investigation already published.",
    openSlug: "usd-coin",
  });
  assert.equal(requestExistsOutcome({ slug: "x", draft: true, message: "Anything" }).openSlug, null);
  assert.equal(requestExistsOutcome({ slug: "x", message: DRAFT_MESSAGE }).openSlug, null);
  assert.equal(requestExistsOutcome({ message: "Request queued." }).openSlug, null);
});
