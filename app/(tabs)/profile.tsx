/**
 * Profile — the one place sign-in lives.
 *
 * ONE SESSION MODEL (2026-09-18). Signed in means a Supabase session exists,
 * and nothing else. A connected wallet is an MWA authorization: useful, but not
 * an identity. The first device test conflated them — the owner connected a
 * wallet, read the address on this screen as being signed in, and then met
 * sign-in prompts on every other tab. So:
 *
 *   - signed out, no wallet     → "Sign in with Solana", pinned above the tab
 *                                 bar (Screen `footer`): connect and sign in in
 *                                 one wallet trip
 *   - signed out, wallet        → the same pinned button, "Sign in with this
 *                                 wallet", with the address in a small line
 *   - signed in                 → no sign-in control anywhere on the screen:
 *                                 identity, the Seeker/SKR facts the server
 *                                 actually returned, wallet watch, Sign out.
 *
 * The Seeker and SKR pills are read from `/api/me` (migration 050 ships
 * `seeker_verified` and `skr_tier`); the placeholders and their caveat are
 * gone. `PATCH /api/me` with the SIWS proof is what makes them true, and the
 * session provider sends it the moment a wallet sign-in succeeds.
 *
 * 0.2.7: signed in, the screen opens with the requests (src/profile/ProfileTop.tsx:
 * handle + badges, two tiles, queue / published lists, a four-number strip);
 * the request box and the Wallet Guardian row are gone from this screen.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Button,
  WalletButton,
  Card,
  Divider,
  Field,
  Mono,
  Prose,
  Screen,
  color,
  space,
} from "@/src/design";
import { ProfileTop } from "@/src/profile/ProfileTop";
import { PerksCard } from "@/src/perks/PerksCard";
import { skrLine } from "@/src/session/skr";
import { useSession } from "@/src/session";
import { signInActionLabel } from "@/src/session/sign-in-action";
import { WALLET_CANCELLED_MESSAGE } from "@/src/solana/sign-in-diagnostics";
import { FollowOnXLink, ImpactLedger } from "@/src/retention/ImpactLedger";

export default function ProfileScreen() {
  const router = useRouter();
  const {
    configured,
    missingKeys,
    signedIn,
    me,
    wallet,
    connecting,
    error,
    errorDetails,
    needsHandle,
    signInWithWallet,
    signInWithEmail,
    linkWallet,
    finishSignUp,
    createHandle,
    signOut,
  } = useSession();

  const [email, setEmail] = useState("");
  const [emailNote, setEmailNote] = useState<string | null>(null);
  // Supabase allows only a few sign-in emails an hour for the whole project
  // ("email rate limit exceeded" on a Seeker, 2026-10-03, after a double tap).
  // One send, then the button rests for a minute.
  const [emailLocked, setEmailLocked] = useState(false);
  useEffect(() => {
    if (!emailLocked) return;
    const t = setTimeout(() => setEmailLocked(false), 60_000);
    return () => clearTimeout(t);
  }, [emailLocked]);
  const [handle, setHandle] = useState("");
  // Keyboard up: the Screen already lifts the page above it; this keeps the
  // email field AND its button reachable (extra room to scroll, and a scroll
  // to the bottom, where the email card sits) when the field takes focus.
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardUp(true);
      if (signedIn) return;
      setTimeout(() => {
        if (TextInput.State.currentlyFocusedInput()) scrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [signedIn]);

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copied = copiedText !== null && copiedText === errorDetails;
  const onCopyDetails = useCallback(async () => {
    if (!errorDetails) return;
    try {
      await Clipboard.setStringAsync(errorDetails);
      setCopiedText(errorDetails);
    } catch {
      setCopiedText(null);
    }
  }, [errorDetails]);

  const onEmail = useCallback(async () => {
    if (emailLocked) return;
    // Locked while sending (no double tap), kept for a minute only if the
    // link actually went out: a typo or no network should be retryable now.
    setEmailLocked(true);
    setEmailNote(null);
    const sent = await signInWithEmail(email);
    if (!sent) {
      setEmailLocked(false);
      return;
    }
    setEmailNote("Check your inbox. The link opens this app.");
  }, [email, emailLocked, signInWithEmail]);

  const account = me?.account ?? null;
  const linkedWallet = account?.wallet_pubkey ?? null;
  const walletProved = Boolean(account?.wallet_verified_at);

  // Pinned above the tab bar: the thumb is already there and the wallet's own
  // sheet opens at the bottom. One tap connects AND signs in (a single wallet
  // trip, see signInWithSolana), so there is no second "sign in" step later.
  const signInFooter = (
    <View style={{ gap: space.sm }}>
      {wallet ? (
        <Mono size="micro" tone="muted">
          wallet connected: {shorten(wallet.address)}
        </Mono>
      ) : null}
      <WalletButton
        panel
        label={signInActionLabel({ connecting, walletConnected: wallet !== null })}
        onPress={() => void signInWithWallet()}
        disabled={connecting || !configured}
      />
    </View>
  );

  // A cancel is not a failure: a quiet sentence, no red card, no Copy details.
  const cancelled = error === WALLET_CANCELLED_MESSAGE && !errorDetails;
  const errorCard = (
    cancelled ? (
      <Prose tone="secondary" style={{ marginTop: space.lg }}>
        {error}
      </Prose>
    ) : error ? (
      <Card style={{ marginTop: space.lg }}>
        <Prose tone="secondary">{error}</Prose>
        {errorDetails ? (
          <>
            <View style={{ height: space.sm }} />
            <Button
              label={copied ? "Copied" : "Copy details"}
              onPress={() => void onCopyDetails()}
              accessibilityHint="Copies the technical details of this failure so you can paste them into a message"
            />
          </>
        ) : null}
      </Card>
    ) : null
  );
  return (
    <Screen
      title="Profile"
      scrollRef={scrollRef}
      footer={signedIn ? undefined : signInFooter}
      // Room under the last control so it can scroll clear of the keyboard.
      contentStyle={keyboardUp ? { paddingBottom: space.xxl * 4 } : { paddingBottom: space.xl }}
    >
      {/*
        Never rendered when the keys are present. The panel is for the owner,
        not for an engineer: it says what is off, what still works, and that
        the fix is a new build — the values are inlined by Expo at bundle time,
        so nothing on the phone can turn this on.
      */}
      {!configured ? (
        <Card style={{ marginBottom: space.lg }}>
          <Prose tone="secondary">
            This build can't sign in. Searching, reading and scanning still work.
          </Prose>
        </Card>
      ) : null}

      {signedIn ? (
        <ProfileTop
          handle={account?.handle ?? null}
          seekerVerified={account?.seeker_verified === true}
          skrTier={account?.skr_tier ?? "none"}
          submissions={me?.recent_submissions}
          rep={me?.rep ?? null}
          onOpenPage={(slug) => router.push(`/entity/${slug}`)}
          onOpenRequest={(id) => router.push(`/request/${id}`)}
          onOpenTab={(tab) => router.push(`/${tab}`)}
        />
      ) : null}

      {signedIn ? (
        <SignedIn
          handleValue={handle}
          onHandleChange={setHandle}
          needsHandle={needsHandle}
          // An email user has no pending wallet proof, so they get the plain
          // PATCH /api/me {handle}; a wallet user spends the parked proof.
          meLoaded={me !== null}
          onFinishSignUp={() => void (needsHandle ? finishSignUp(handle) : createHandle(handle))}
          connecting={connecting}
          email={me?.email ?? null}
          accountHandle={account?.handle ?? null}
          skrTier={account?.skr_tier ?? "none"}
          skrLiquid={account?.skr_liquid ?? null}
          skrStaked={account?.skr_staked ?? null}
          linkedWallet={linkedWallet}
          walletProved={walletProved}
          connectedWallet={wallet?.address ?? null}
          onLinkWallet={() => void linkWallet()}
          onSignOut={() => void signOut()}
        >
          {/* A failure sentence belongs next to the controls above, not under Sign out. */}
          {errorCard}
          {/* Loop 4 — what your activity changed, above Sign out. */}
          <ImpactLedger
            signedIn
            submissions={me?.recent_submissions}
            onOpenPage={(slug) => router.push(`/entity/${slug}`)}
            onOpenRequest={(id) => router.push(`/request/${id}`)}
            onOpenScan={(address) => router.push({ pathname: "/scan", params: { address } })}
          />
        </SignedIn>
      ) : (
        <SignedOutIntro onSignIn={() => void signInWithWallet()} disabled={connecting || !configured} />
      )}

      {/* Loop 4 for a signed-out visitor: the requests this phone made. Hidden
          when there are none, so it never renders as an empty box. */}
      {!signedIn ? (
        <ImpactLedger
          signedIn={false}
          onOpenPage={(slug) => router.push(`/entity/${slug}`)}
          onOpenRequest={(id) => router.push(`/request/${id}`)}
        />
      ) : null}

      {signedIn ? null : (
        <>
          {/* Signed out: the failure sentence and the email fallback sit above
              the pinned footer, so what the owner needs after a tap is next
              to the thumb. */}
          <View style={{ height: space.lg }} />
          {errorCard}
          <View style={{ height: space.lg }} />
          <EmailSignIn
            configured={configured}
            email={email}
            onEmailChange={setEmail}
            onSendLink={() => void onEmail()}
            emailNote={error ? null : emailNote}
            emailLocked={emailLocked}
          />
          <FollowOnXLink />
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** Everything a session buys. No sign-in control appears below this line. */
function SignedIn(props: {
  handleValue: string;
  onHandleChange: (value: string) => void;
  needsHandle: boolean;
  meLoaded: boolean;
  onFinishSignUp: () => void;
  connecting: boolean;
  email: string | null;
  accountHandle: string | null;
  skrTier: string;
  skrLiquid: number | null;
  skrStaked: number | null;
  linkedWallet: string | null;
  walletProved: boolean;
  connectedWallet: string | null;
  onLinkWallet: () => void;
  onSignOut: () => void;
  children?: ReactNode;
}) {
  return (
    <>
      {/* No bottom margin: the next card carries marginTop (lg), and RN margins
          do not collapse, so both used to stack into a double gap. */}
      <Card>
        {/* The handle and badges are the single line above (ProfileTop). */}
        {props.accountHandle ? null : props.needsHandle || props.meLoaded ? (
          <>
            <Prose tone="secondary">Pick a name.</Prose>
            <View style={{ height: space.sm }} />
            <Field
              value={props.handleValue}
              onChangeText={props.onHandleChange}
              placeholder="handle (3–32 letters, numbers, - or _)"
              autoCapitalize="none"
            />
            <View style={{ height: space.sm }} />
            <Button
              label={props.connecting ? "Creating…" : "Create account"}
              tier="primary"
              onPress={props.onFinishSignUp}
              disabled={props.connecting || props.handleValue.trim().length < 3}
            />
          </>
        ) : (
          <Prose tone="secondary">
            Signed in, no handle yet.
          </Prose>
        )}

        {props.email ? (
          <Mono size="micro" tone="muted" style={{ marginTop: props.accountHandle ? 0 : space.sm }}>
            {props.email}
          </Mono>
        ) : null}

        {props.accountHandle && !props.email ? null : <Divider />}

        <Mono size="label" label tone="muted">
          Wallet
        </Mono>
        {props.linkedWallet ? (
          <>
            <Mono size="body" style={{ marginTop: space.sm }}>
              {shorten(props.linkedWallet)}
            </Mono>
            <Mono size="micro" tone="muted" style={{ marginTop: 4 }} label>
              {props.walletProved ? "verified" : "not verified"}
            </Mono>
          </>
        ) : (
          <>
            <Prose tone="secondary" style={{ marginTop: space.sm }}>
              Link a wallet to prove you own it.
            </Prose>
            {props.connectedWallet ? (
              <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
                connected on this phone: {shorten(props.connectedWallet)}
              </Mono>
            ) : null}
            <View style={{ height: space.sm }} />
            <WalletButton
              label={props.connecting ? "Waiting for wallet…" : "Link a wallet"}
              onPress={props.onLinkWallet}
              disabled={props.connecting}
            />
          </>
        )}

        {props.linkedWallet ? (
          <>
            <SkrRow tier={props.skrTier} liquid={props.skrLiquid} staked={props.skrStaked} />
            <PerksCard skrTier={props.skrTier} />
          </>
        ) : null}
      </Card>

      {props.children}

      <View style={{ height: space.lg }} />
      <Button label="Sign out" tier="primary" onPress={props.onSignOut} />
    </>
  );
}

/** "182 SKR · Holder", what the tier gets, and the next step. Wording: src/session/skr.ts. */
function SkrRow(props: { tier: string; liquid: number | null; staked: number | null }) {
  const line = skrLine(props.tier, props.liquid, props.staked);
  return (
    <View style={{ marginTop: space.md }}>
      <Prose weight="medium">{line.title}</Prose>
      <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
        {line.perks}
      </Mono>
      <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
        {line.next}
      </Mono>
    </View>
  );
}

/** Signed out, top of the screen: one sentence. The action is pinned below. */
function SignedOutIntro(props: { onSignIn: () => void; disabled: boolean }) {
  return (
    <Prose tone="secondary">
      <Prose
        color={color.accentAnchor}
        onPress={props.disabled ? undefined : props.onSignIn}
        accessibilityRole="link"
        suppressHighlighting
      >
        Sign in
      </Prose>{" "}
      to follow pages, get alerts and submit evidence.
    </Prose>
  );
}

/** The secondary option, just above the pinned wallet button. */
function EmailSignIn(props: {
  configured: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onSendLink: () => void;
  emailNote: string | null;
  emailLocked: boolean;
}) {
  return (
    <Card>
      <Mono size="label" label tone="muted">
        Or use email
      </Mono>
      <View style={{ height: space.sm }} />
      <Field
        value={props.email}
        onChangeText={props.onEmailChange}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <View style={{ height: space.sm }} />
      <Button
        label={props.emailLocked ? "Try again in a minute" : "Email me a link"}
        onPress={props.onSendLink}
        disabled={!props.configured || props.emailLocked || props.email.trim().length === 0}
      />
      {props.emailNote ? (
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          {props.emailNote}
        </Prose>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function shorten(address: string): string {
  if (address.length <= 18) return address;
  return `${address.slice(0, 8)}…${address.slice(-8)}`;
}
