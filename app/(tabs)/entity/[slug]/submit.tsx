/**
 * Submit evidence, and countersign it from the user's own wallet (J5 / D5).
 *
 * Two steps on one screen, deliberately: the submission is the thing that
 * matters and it completes on its own, and the countersign is an OPT-IN second
 * act that only appears once there is a `content_hash` to sign. Presenting
 * them as one flow would make a wallet prompt feel mandatory for contributing
 * evidence, which it is not.
 *
 * The five kinds and their payload shapes are taken from
 * web/src/app/api/submissions/route.ts `validatePayload()` — `payload.kind`
 * must equal the top-level `kind`, and each kind's required fields are checked
 * server-side before anything is hashed. The sixth kind the route accepts,
 * `file`, is not offered: it wants a filename, a SHA-256 and a byte count for
 * a file the app has no upload path for.
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WhileFocused, goBack } from "@/src/navigation/hidden-route";
import {
  Button,
  Card,
  Divider,
  Field,
  Mono,
  Prose,
  QueueLink,
  Screen,
  StageProgress,
  StatusPill,
  border,
  color,
  radius,
  space,
} from "@/src/design";
import { createSubmission, type SubmissionPayload } from "@/src/api/submissions";
import { ApiError } from "@/src/api/client";
import type { SubmissionRow, SubmissionValence } from "@/src/api/types";
import { webUrl } from "@/src/api/config";
import { toAttestationCluster } from "@/src/api/attestations";
import { SignInLink, useSession } from "@/src/session";
import { DEFAULT_CLUSTER, explorerTxUrl } from "@/src/solana/cluster";
import { countersignSubmission, recordPendingAttestation } from "@/src/solana/countersign";
import type { PendingAttestation } from "@/src/solana/pending-attestations";

/** The kinds this screen offers. Order is the route's VALID_KINDS order. */
const KINDS = ["url", "tx", "address", "account", "claim"] as const;
type OfferedKind = (typeof KINDS)[number];

const KIND_HELP: Record<OfferedKind, string> = {
  url: "A report, filing, thread or article.",
  tx: "A transaction on any chain.",
  address: "A wallet or contract address.",
  account: "A social or exchange account.",
  claim: "A statement in your own words. Moderators read every claim.",
};

function SubmitEvidenceScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { signedIn, signedOut, me, wallet, withWallet } = useSession();

  const [kind, setKind] = useState<OfferedKind>("url");
  const [valence, setValence] = useState<SubmissionValence>("incriminating");
  const [url, setUrl] = useState("");
  const [chain, setChain] = useState("solana");
  const [txHash, setTxHash] = useState("");
  const [address, setAddress] = useState("");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [claimText, setClaimText] = useState("");
  const [note, setNote] = useState("");

  // Default follows the account's own preference, exactly as the route does
  // when `show_handle` is omitted: `!anon_by_default`.
  const [showHandle, setShowHandle] = useState<boolean>(!me?.account?.anon_by_default);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmissionRow | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A 401 mid-submission: the token went stale, so offer the way back in. */
  const [expired, setExpired] = useState(false);

  const payload = useMemo<SubmissionPayload | null>(() => {
    switch (kind) {
      case "url":
        return url.trim() ? { kind: "url", url: url.trim() } : null;
      case "tx":
        return chain.trim() && txHash.trim()
          ? { kind: "tx", chain: chain.trim(), tx_hash: txHash.trim() }
          : null;
      case "address":
        return chain.trim() && address.trim()
          ? { kind: "address", chain: chain.trim(), address: address.trim() }
          : null;
      case "account":
        return platform.trim() && handle.trim()
          ? { kind: "account", platform: platform.trim(), handle: handle.trim() }
          : null;
      case "claim":
        return claimText.trim().length >= 3 ? { kind: "claim", text: claimText.trim() } : null;
    }
  }, [kind, url, chain, txHash, address, platform, handle, claimText]);

  const onSubmit = useCallback(async () => {
    if (!slug || !payload) return;
    setSubmitting(true);
    setError(null);
    setExpired(false);
    try {
      const result = await createSubmission({
        slug,
        kind,
        payload,
        valence,
        note: note.trim() || undefined,
        show_handle: showHandle,
      });
      setSubmitted(result.submission);
      setDuplicate(result.duplicate === true);
    } catch (err) {
      setExpired(err instanceof ApiError && err.status === 401);
      setError(submitErrorText(err));
    } finally {
      setSubmitting(false);
    }
  }, [slug, payload, kind, valence, note, showHandle]);

  // ---- signed-out gate ----------------------------------------------------
  // The route accepts anonymous submissions, but a countersign needs an
  // account with a verified wallet and an anonymous submission cannot be
  // attributed to the submitter. So this screen is for signed-in users, and
  // says where to sign in rather than failing at the POST.
  if (!signedIn) {
    // Session still loading: show nothing rather than a prompt to sign in.
    if (!signedOut) return <Screen title="Submit evidence">{null}</Screen>;
    return (
      <Screen title="Submit evidence">
        <BackLink onPress={() => goBack(router)} />
        <Card>
          <Prose tone="secondary">
            Sign in to submit evidence. It is attributed to your account.
          </Prose>
        </Card>
        <View style={{ height: space.lg }} />
        <Button label="Go to Profile" tier="primary" onPress={() => router.push("/profile")} />
      </Screen>
    );
  }

  if (submitted) {
    return (
      <SubmittedPanel
        slug={slug ?? ""}
        submission={submitted}
        duplicate={duplicate}
        walletPubkey={me?.account?.wallet_pubkey ?? null}
        walletVerifiedAt={me?.account?.wallet_verified_at ?? null}
        connectedWallet={wallet?.address ?? null}
        withWallet={withWallet}
        onDone={() => goBack(router)}
        onLinkWallet={() => router.push("/profile")}
        onActivity={() => router.push("/profile")}
      />
    );
  }

  return (
    <Screen title="Submit evidence">
      <BackLink onPress={() => goBack(router)} />

      <Card style={{ marginBottom: space.lg }}>
        <Mono size="label" label tone="muted">
          Type
        </Mono>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm }}>
          {KINDS.map((k) => (
            <Choice key={k} label={k} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <Prose tone="muted" size="body" style={{ marginTop: space.sm }}>
          {KIND_HELP[kind]}
        </Prose>

        <Divider />

        <Mono size="label" label tone="muted">
          This evidence is
        </Mono>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm }}>
          <Choice
            label="against"
            selected={valence === "incriminating"}
            onPress={() => setValence("incriminating")}
          />
          <Choice
            label="in favour"
            selected={valence === "exonerating"}
            onPress={() => setValence("exonerating")}
          />
          <Choice
            label="neutral"
            selected={valence === "neutral"}
            onPress={() => setValence("neutral")}
          />
        </View>
      </Card>

      <Card style={{ marginBottom: space.lg }}>
        {kind === "url" ? (
          <Field
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            keyboardType="url"
            autoCapitalize="none"
          />
        ) : null}

        {kind === "tx" ? (
          <>
            <Field value={chain} onChangeText={setChain} placeholder="Chain (solana, ethereum, …)" />
            <View style={{ height: space.sm }} />
            <Field value={txHash} onChangeText={setTxHash} placeholder="Transaction hash" />
          </>
        ) : null}

        {kind === "address" ? (
          <>
            <Field value={chain} onChangeText={setChain} placeholder="Chain (solana, ethereum, …)" />
            <View style={{ height: space.sm }} />
            <Field value={address} onChangeText={setAddress} placeholder="Address" />
          </>
        ) : null}

        {kind === "account" ? (
          <>
            <Field value={platform} onChangeText={setPlatform} placeholder="Platform (x, telegram, …)" />
            <View style={{ height: space.sm }} />
            <Field value={handle} onChangeText={setHandle} placeholder="Handle" />
          </>
        ) : null}

        {kind === "claim" ? (
          <Field
            value={claimText}
            onChangeText={setClaimText}
            placeholder="What you know"
            multiline
            autoCapitalize="sentences"
            style={{ minHeight: 96, textAlignVertical: "top" }}
          />
        ) : null}

        <Divider />

        <Field
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          multiline
          autoCapitalize="sentences"
          style={{ minHeight: 64, textAlignVertical: "top" }}
        />
      </Card>

      <Card style={{ marginBottom: space.lg }}>
        <Pressable onPress={() => setShowHandle((v) => !v)} accessibilityRole="switch">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: border.width,
                borderStyle: border.style,
                borderColor: showHandle ? color.textPrimary : color.borderDefault,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showHandle ? <Mono size="micro">×</Mono> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Prose>
                Show my handle{showHandle && me?.account?.handle ? ` (@${me.account.handle})` : ""}
              </Prose>
              {showHandle ? null : (
                <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                  Anonymous submissions still count toward your rep.
                </Mono>
              )}
            </View>
          </View>
        </Pressable>
      </Card>

      {error ? (
        <Card style={{ marginBottom: space.lg }} severity="high">
          <Prose tone="secondary">
            {error}
            {expired ? <> <SignInLink /> again, then resubmit.</> : null}
          </Prose>
        </Card>
      ) : null}

      <Button
        label={submitting ? "Submitting…" : "Submit evidence"}
        tier="primary"
        onPress={() => void onSubmit()}
        disabled={submitting || !payload}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — the countersign
// ---------------------------------------------------------------------------

/** The three steps the success panel lights up. */
const SUBMISSION_STAGES = ["Submitted", "Under review", "Decided"] as const;

type CountersignPhase =
  | { state: "idle" }
  | { state: "signing" }
  | { state: "done"; signature: string; cluster: string }
  | { state: "retryable"; pending: PendingAttestation; message: string }
  | { state: "failed"; message: string };

function SubmittedPanel({
  slug,
  submission,
  duplicate,
  walletPubkey,
  walletVerifiedAt,
  connectedWallet,
  withWallet,
  onDone,
  onLinkWallet,
  onActivity,
}: {
  slug: string;
  submission: SubmissionRow;
  duplicate: boolean;
  walletPubkey: string | null;
  walletVerifiedAt: string | null;
  connectedWallet: string | null;
  withWallet: ReturnType<typeof useSession>["withWallet"];
  onDone: () => void;
  onLinkWallet: () => void;
  onActivity: () => void;
}) {
  const [phase, setPhase] = useState<CountersignPhase>({ state: "idle" });

  // The route's cluster enum is mainnet-beta | devnet only; the app also has
  // testnet, and a countersign there would be rejected with a 400.
  const cluster = toAttestationCluster(DEFAULT_CLUSTER);
  const verified = Boolean(walletPubkey && walletVerifiedAt);
  const decided = submission.status === "accepted" || submission.status === "rejected";

  const onCountersign = useCallback(async () => {
    if (!cluster || !walletPubkey) return;
    setPhase({ state: "signing" });
    const result = await countersignSubmission({
      submissionId: submission.id,
      contentHash: submission.content_hash,
      slug,
      cluster,
      expectedSigner: walletPubkey,
      withWallet,
    });
    setPhase(toPhase(result, cluster));
  }, [cluster, walletPubkey, submission.id, submission.content_hash, slug, withWallet]);

  const onRetryVerification = useCallback(async () => {
    if (phase.state !== "retryable") return;
    const pending = phase.pending;
    setPhase({ state: "signing" });
    const result = await recordPendingAttestation(pending);
    setPhase(toPhase(result, pending.cluster));
  }, [phase]);

  return (
    <Screen title="Submitted">
      <Card style={{ marginBottom: space.lg }}>
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          <StatusPill label={duplicate ? "already submitted" : submission.status} tone="neutral" />
          <StatusPill label={submission.kind} tone="neutral" />
          <StatusPill
            label={
              submission.valence === "exonerating"
                ? "in favour"
                : submission.valence === "neutral"
                  ? "neutral"
                  : "against"
            }
            tone={
              submission.valence === "exonerating"
                ? "verified"
                : submission.valence === "neutral"
                  ? "neutral"
                  : "caution"
            }
          />
        </View>
        <Prose style={{ marginTop: space.md }}>
          {duplicate ? "Already submitted." : "Received. A moderator will review it."}
        </Prose>
        <StageProgress
          steps={SUBMISSION_STAGES}
          current={decided ? 2 : 1}
          complete={decided}
          style={{ marginTop: space.md }}
        />
        <Divider />
        <Prose tone="secondary">
          It now shows as &ldquo;Under review&rdquo; in your activity on Profile.
        </Prose>
        <QueueLink label="See it in your activity →" onPress={onActivity} />
        <QueueLink label="See pending evidence →" url={webUrl("submit/pending")} style={{ minHeight: 36 }} />
      </Card>

      <Card style={{ marginBottom: space.lg }}>
        <Mono size="label" label tone="muted">
          Countersign (optional)
        </Mono>
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          Vouch for this evidence with a small Solana transaction (about 0.000005 SOL). Your
          wallet address will be public. Nothing else is approved.
        </Prose>

        <Divider />

        {!cluster ? (
          <Prose tone="secondary">
            Countersigning isn&apos;t available on {DEFAULT_CLUSTER}.
          </Prose>
        ) : !verified ? (
          <>
            <Prose tone="secondary">
              {walletPubkey
                ? "Your wallet is linked but not verified. Link it again on the Profile tab."
                : "Link a wallet to prove you own it."}
            </Prose>
            <View style={{ height: space.md }} />
            <Button label="Link a wallet" onPress={onLinkWallet} />
          </>
        ) : phase.state === "signing" ? (
          <View style={{ gap: space.sm }}>
            <ActivityIndicator color={color.textMuted} />
            <Mono size="micro" tone="muted">
              Waiting for your wallet…
            </Mono>
          </View>
        ) : phase.state === "done" ? (
          <>
            <StatusPill label="countersigned" tone="verified" />
            <Prose tone="secondary" style={{ marginTop: space.sm }}>
              Recorded in the audit trail.
            </Prose>
            <Pressable
              onPress={() =>
                void Linking.openURL(explorerTxUrl(phase.signature, phase.cluster))
              }
              style={{ marginTop: space.sm }}
            >
              <Mono size="micro" tone="secondary">
                {phase.signature.slice(0, 16)}… ↗ explorer
              </Mono>
            </Pressable>
          </>
        ) : phase.state === "retryable" ? (
          <>
            <StatusPill label="sent, not yet recorded" tone="caution" />
            <Prose tone="secondary" style={{ marginTop: space.sm }}>
              {phase.message}
            </Prose>
            <Mono size="micro" tone="muted" style={{ marginTop: space.sm }}>
              Retrying will not send again.
            </Mono>
            <View style={{ height: space.md }} />
            <Button label="Retry verification" tier="primary" onPress={() => void onRetryVerification()} />
          </>
        ) : phase.state === "failed" ? (
          <>
            <Prose tone="secondary">{phase.message}</Prose>
            <View style={{ height: space.md }} />
            <Button label="Try countersigning again" onPress={() => void onCountersign()} />
          </>
        ) : (
          <>
            <Mono size="micro" tone="muted">
              signing as {shorten(walletPubkey ?? "")}
              {connectedWallet && connectedWallet !== walletPubkey
                ? " — your wallet app has a different account selected"
                : ""}
            </Mono>
            <View style={{ height: space.md }} />
            <Button label="Countersign on-chain" tier="primary" onPress={() => void onCountersign()} />
          </>
        )}
      </Card>

      <Button label="Done" onPress={onDone} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function toPhase(
  result: Awaited<ReturnType<typeof countersignSubmission>>,
  cluster: string,
): CountersignPhase {
  if (result.ok) {
    return { state: "done", signature: result.attestation.memo_signature, cluster };
  }
  return result.retryable
    ? { state: "retryable", pending: result.pending, message: result.message }
    : { state: "failed", message: result.message };
}

/**
 * Plain words for each failure the submissions route can give.
 *
 * 429 carries `Retry-After` as a header AND `retry_after_seconds` in the body;
 * the body is what a fetch response reliably exposes here, and the route sets
 * both from the same value (checkSubmissionRateLimit).
 */
function submitErrorText(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't submit. Try again.";

  if (err.status === 401) {
    // The caller appends a tappable sign-in link after this sentence.
    return "Your session has ended.";
  }
  if (err.status === 429) {
    const body = err.body as { retry_after_seconds?: unknown; scope?: unknown } | null;
    const seconds = typeof body?.retry_after_seconds === "number" ? body.retry_after_seconds : null;
    const scope = body?.scope === "page" ? " for this page" : "";
    return seconds
      ? `Submission limit reached${scope}. Try again in ${describeSeconds(seconds)}.`
      : `Submission limit reached${scope}. Try again later.`;
  }
  if (err.status === 404) {
    return "That page no longer exists.";
  }
  return "Couldn't submit. Try again.";
}

function describeSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function shorten(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: space.lg }}>
      <Mono size="label" label tone="muted">
        ← back
      </Mono>
    </Pressable>
  );
}

/** A dashed segmented choice — the house idiom, no filled controls. */
function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View
        style={{
          borderWidth: border.width,
          borderStyle: selected ? "solid" : border.style,
          borderColor: selected ? color.textPrimary : color.borderDefault,
          borderRadius: radius.card,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
        }}
      >
        <Mono size="label" label tone={selected ? "primary" : "muted"}>
          {label}
        </Mono>
      </View>
    </Pressable>
  );
}

export default function SubmitEvidenceRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <WhileFocused id={slug}>
      <SubmitEvidenceScreen />
    </WhileFocused>
  );
}
