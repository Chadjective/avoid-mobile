/**
 * Live investigation progress (J4).
 *
 * Reached from Search when nothing matches and the user asks for a page to be
 * made. It answers one question — "is it done yet?" — and offers one thing to
 * do while it is not: be told when it publishes.
 *
 * TWO SOURCES, ON PURPOSE (see src/api/run-events.ts for the RLS evidence):
 *
 *   status    ← a BOUNDED poll of the public GET /api/requests/:id.
 *               `investigation_requests` is RLS'd to the owning account and is
 *               not in the Realtime publication, so its status cannot be
 *               subscribed to with the anon key. Every poll is a billed Vercel
 *               invocation (web/CLAUDE.md), so the schedule is 5s → 10s → 20s
 *               and stops at five minutes — about 24 requests, then a
 *               "check later" state. Never unbounded, and it stops the moment
 *               the status is terminal.
 *   timeline  ← Supabase Realtime on `investigation_run_events`, which DOES
 *               allow anon SELECT (`USING (true)`) and IS in the
 *               supabase_realtime publication. It costs no invocations. It is
 *               also usually empty, because only the paid drain path writes
 *               those rows — so it is an enrichment, never the answer.
 *
 * ANTICIPATION (docs/RETENTION_LOOPS_SPEC.md §9a). A three-step rail —
 * queued → investigating → published — and, while queued, the one expected
 * wait the app can state honestly: when the queue is next drained, from the
 * published Routine schedule (src/retention/queue-schedule.ts). The route has
 * no queue position or ETA, so the copy says "the next queue run is in about
 * 3 hours", never "your page is ready in 3 hours".
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WhileFocused, goBack } from "@/src/navigation/hidden-route";
import {
  Button,
  Card,
  Divider,
  Field,
  Mono,
  ProgressArc,
  Prose,
  QueueLink,
  Screen,
  StageProgress,
  StatusPill,
  WalletButton,
  color,
  space,
  useReducedMotion,
} from "@/src/design";
import {
  getRequest,
  hasRequestEditToken,
  isRequestTerminal,
  setNotifyEmail,
} from "@/src/api/requests";
import type { InvestigationRequest } from "@/src/api/types";
import { ApiError } from "@/src/api/client";
import { webUrl } from "@/src/api/config";
import {
  describeRunEvent,
  getLatestRunId,
  getRunEvents,
  subscribeToRunEvents,
  type RunEvent,
} from "@/src/api/run-events";
import { hasRegisteredPushDevice, registerForPushNotifications } from "@/src/notifications";
import { DRAIN_BATCH, nextDrainAt, serverEstimate, untilInWords } from "@/src/retention/queue-schedule";
import {
  REQUEST_STAGES,
  arcFraction,
  arcWindowStart,
  formatCountdown,
  placeInLine,
  stageFromStatus,
} from "@/src/retention/request-progress";
import { relativeTime } from "@/src/retention/time";
import { SignInLink, useSession } from "@/src/session";
import { SKR_HOLDER_MIN, SKR_PERKS, SKR_STAKER_MIN, normalizeSkrTier } from "@/src/session/skr";
import { signInActionLabel } from "@/src/session/sign-in-action";
import { boostCopy } from "@/src/profile/requests-view";

/**
 * The poll schedule, in the shape web/src/lib/poll-schedule.ts uses: how long
 * to wait next, given how long we have been waiting, or null to stop.
 *
 * 5s for the first half-minute, 10s to two minutes, 20s to five — 6 + 9 + 9 =
 * 24 requests for a full run, against the unbounded 5s loop this replaces.
 */
const POLL_TIERS: ReadonlyArray<{ untilMs: number; intervalMs: number }> = [
  { untilMs: 30_000, intervalMs: 5_000 },
  { untilMs: 120_000, intervalMs: 10_000 },
  { untilMs: 300_000, intervalMs: 20_000 },
];
const POLL_MAX_MS = 300_000;

export function nextPollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= POLL_MAX_MS) return null;
  for (const tier of POLL_TIERS) {
    if (elapsedMs < tier.untilMs) return tier.intervalMs;
  }
  return null;
}

const STATUS: Record<string, { label: string; tone: "neutral" | "caution" | "verified" | "critical"; text: string }> = {
  queued: {
    label: "Queued",
    tone: "neutral",
    text: "In the queue.",
  },
  running: {
    label: "Researching",
    tone: "caution",
    text: "Being researched now.",
  },
  fulfilled: {
    label: "Published",
    tone: "verified",
    text: "",
  },
  failed: {
    label: "Failed",
    tone: "critical",
    text: "This one didn't finish and nothing was published. Try requesting it again.",
  },
  rejected: {
    label: "Rejected",
    tone: "critical",
    text: "Declined.",
  },
};

function RequestStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { signedIn, signedOut } = useSession();

  const [request, setRequest] = useState<InvestigationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [events, setEvents] = useState<RunEvent[]>([]);

  const startedAt = useRef<number>(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** One liveness flag for both the effect-driven poll and "check again". */
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // ---- status: bounded poll ------------------------------------------------
  const poll = useCallback(
    async function run(requestId: string, active: () => boolean): Promise<void> {
      try {
        const next = await getRequest(requestId);
        if (!active()) return;
        setRequest(next);
        setError(null);
        if (isRequestTerminal(next.status)) return;
      } catch (err) {
        if (!active()) return;
        setError(err instanceof ApiError && err.status === 404 ? "No request with that id." : "Couldn't load. Pull down to retry.");
        if (err instanceof ApiError && err.status === 404) return;
      }

      const delay = nextPollDelay(Date.now() - startedAt.current);
      if (delay === null) {
        if (active()) setExhausted(true);
        return;
      }
      timer.current = setTimeout(() => {
        if (active()) void run(requestId, active);
      }, delay);
    },
    [],
  );

  useEffect(() => {
    if (!id) return;
    startedAt.current = Date.now();
    setExhausted(false);
    void poll(id, () => mounted.current);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, poll]);

  // ---- timeline: Supabase Realtime ----------------------------------------
  useEffect(() => {
    if (!id) return;
    let live = true;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const runId = await getLatestRunId(id);
      if (!live || !runId) return;
      setEvents(await getRunEvents(runId));
      if (!live) return;
      unsubscribe = subscribeToRunEvents(runId, (event) => {
        setEvents((prev) =>
          prev.some((e) => e.seq === event.seq) ? prev : [...prev, event].sort((a, b) => a.seq - b.seq),
        );
      });
    })();

    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [id]);

  const checkNow = useCallback(() => {
    if (!id) return;
    startedAt.current = Date.now();
    setExhausted(false);
    void poll(id, () => mounted.current);
  }, [id, poll]);

  if (!request && error) {
    return (
      <Screen title="request">
        <Card>
          <Prose tone="secondary">{error}</Prose>
        </Card>
        <View style={{ height: space.lg }} />
        <Button label="Back" onPress={() => goBack(router)} />
      </Screen>
    );
  }

  if (!request) {
    return (
      <Screen title="request">
        <ActivityIndicator color={color.textMuted} />
      </Screen>
    );
  }

  const cfg = STATUS[request.status] ?? STATUS.queued;
  const terminal = isRequestTerminal(request.status);

  return (
    <Screen title="investigation request">
      <Pressable onPress={() => goBack(router)} style={{ marginBottom: space.lg }}>
        <Mono size="label" label tone="muted">
          ← back
        </Mono>
      </Pressable>

      <Card style={{ marginBottom: space.lg }}>
        <Prose size="heading" weight="semibold">
          {request.entity_name ?? request.slug ?? "this request"}
        </Prose>
        <View style={{ height: space.sm }} />
        <StatusPill label={cfg.label} tone={cfg.tone} />
        <StageBar status={request.status} />
        {cfg.text ? (
          <Prose tone="secondary" style={{ marginTop: space.md }}>
            {cfg.text}
          </Prose>
        ) : null}
        {request.status === "queued" ? <QueueWait
            createdAt={request.created_at}
            position={request.queue_position}
            estimatedRunAt={request.estimated_run_at}
          /> : null}

        {request.status === "fulfilled" ? <PublishedMoment /> : null}

        {request.status === "fulfilled" && request.slug ? (
          <>
            <View style={{ height: space.md }} />
            <Button
              label="Open the page"
              tier="primary"
              onPress={() => router.replace(`/entity/${request.slug}`)}
            />
          </>
        ) : null}

        {request.status === "failed" ? (
          <>
            <View style={{ height: space.md }} />
            <Button label="Back to Search" onPress={() => router.replace("/")} />
          </>
        ) : null}

        {request.rejected_reason ? (
          <>
            <Divider />
            <Mono size="micro" tone="muted">
              {request.rejected_reason}
            </Mono>
          </>
        ) : null}

        <Divider />
        <Mono size="micro" tone="muted">
          submitted {relativeTime(request.created_at)}
        </Mono>
      </Card>

      {!terminal ? (
        <Card style={{ marginBottom: space.lg }}>
          <Mono size="label" label tone="muted">
            Progress
          </Mono>
          {events.length > 0 ? (
            <View style={{ marginTop: space.sm }}>
              {events.map((event) => (
                <View key={`${event.run_id}-${event.seq}`} style={{ marginBottom: space.sm }}>
                  <Mono size="micro" tone="muted">
                    {String(event.seq).padStart(2, "0")} · {formatTime(event.created_at)}
                  </Mono>
                  <Prose tone="secondary" size="body" style={{ marginTop: 2 }}>
                    {describeRunEvent(event)}
                  </Prose>
                </View>
              ))}
            </View>
          ) : (
            <Prose tone="muted" style={{ marginTop: space.sm }}>
              No live log for this request.
            </Prose>
          )}

          <Divider />
          {exhausted ? (
            <>
              <Prose tone="secondary">
                Still working. This can take hours; you can leave.
              </Prose>
              <View style={{ height: space.md }} />
              <Button label="Check again" onPress={checkNow} />
            </>
          ) : null}
        </Card>
      ) : null}

      {!terminal ? <NotifyPanel requestId={request.id} signedIn={signedIn} signedOut={signedOut} /> : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/**
 * One tick a second for the countdown, from a LOCAL timer: no network request.
 * Stops while the app is in the background and catches up on return, so a
 * backgrounded screen costs nothing.
 */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (s) => (s === "active" ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [active]);
  return now;
}

/** Queued → Researching → Published, lit as the status moves. */
function StageBar({ status }: { status: string }) {
  const stage = stageFromStatus(status);
  return (
    <StageProgress
      steps={REQUEST_STAGES}
      current={stage.index}
      complete={stage.complete}
      stopped={stage.stopped}
      style={{ marginTop: space.md }}
    />
  );
}

/** The arc fills in and a check pops: the one celebration on the screen. */
function PublishedMoment() {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(reduced ? 1 : 0.4)).current;
  useEffect(() => {
    if (reduced) {
      pop.setValue(1);
      return;
    }
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [reduced, pop]);
  return (
    <View style={{ alignItems: "center", marginTop: space.lg }}>
      <ProgressArc fraction={1} size={132} glideMs={900} accessibilityLabel="Complete">
        <Animated.View style={{ transform: [{ scale: pop }], opacity: pop }}>
          <Prose size="display" weight="semibold" style={{ color: color.accentAnchor }}>
            ✓
          </Prose>
        </Animated.View>
      </ProgressArc>
      <Prose size="heading" weight="semibold" style={{ marginTop: space.md }}>
        Published!
      </Prose>
      <Prose tone="secondary" style={{ marginTop: space.xs, textAlign: "center" }}>
        The page is live. Open it to see the score and the sources.
      </Prose>
    </View>
  );
}

/**
 * While queued: an arc that fills toward the next queue run with the time left
 * in the middle, your place in line as dots, how long it has waited, and when
 * the queue is next drained (the published schedule). The arc and digits come
 * from a local one-second timer; the position and run time still come from the
 * bounded status poll.
 */
function QueueWait({
  createdAt,
  position,
  estimatedRunAt,
}: {
  createdAt: string;
  position?: number | null;
  estimatedRunAt?: string | null;
}) {
  const nowMs = useNow(true);
  const now = new Date(nowMs);
  // Prefer the server's place in line and run estimate; without them (older
  // server, or an estimate already in the past) fall back to the local schedule.
  const est = serverEstimate(position, estimatedRunAt, now);
  const next = est ? est.runAt : nextDrainAt(now);
  const at = next.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const start = arcWindowStart(Date.parse(createdAt), next.getTime());
  const fraction = arcFraction(start, next.getTime(), nowMs);
  const left = formatCountdown(next.getTime() - nowMs);
  const line = est ? placeInLine(est.position) : null;
  return (
    <>
      <Divider />
      <View style={{ alignItems: "center" }}>
        <ProgressArc
          fraction={fraction}
          accessibilityLabel={`Next queue run ${untilInWords(next, now)}`}
        >
          <Mono size="display" weight="semibold">
            {left}
          </Mono>
          <Mono size="micro" label tone="muted">
            until next run
          </Mono>
        </ProgressArc>
      </View>
      {line ? (
        <View style={{ alignItems: "center", marginTop: space.md }}>
          <Prose weight="semibold">{line.text}</Prose>
          {line.ahead > 0 ? (
            <View
              accessible
              accessibilityLabel={`${line.ahead} ahead of you`}
              style={{ flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.sm }}
            >
              {Array.from({ length: line.dots }, (_, i) => (
                <View
                  key={i}
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.textMuted }}
                />
              ))}
              {line.more > 0 ? (
                <Mono size="micro" tone="muted">
                  +{line.more}
                </Mono>
              ) : null}
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color.accentAnchor, marginLeft: space.xs }}
              />
              <Mono size="micro" tone="secondary">
                you
              </Mono>
            </View>
          ) : null}
        </View>
      ) : null}
      <Mono size="micro" tone="secondary" style={{ marginTop: space.md }}>
        {est ? "Expected in the run" : "Next queue run"}{" "}
        {untilInWords(next, now)} ({at})
      </Mono>
      <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
        Runs every 4 hours, up to {DRAIN_BATCH} requests each, signed-in first.
      </Mono>
      <RankBoost />
      <QueueLink label="See the whole queue →" url={webUrl("queue")} style={{ marginTop: space.xs }} />
    </>
  );
}

/**
 * Under the place in line: how to move up. Signed out gets the sign-in panel
 * (the same wallet trip as Profile); signed in below the holder line gets the
 * two thresholds; a holder or staker gets the priority already applied. The
 * thresholds and perks are the SKR constants in src/session/skr.ts.
 */
function RankBoost() {
  const { signedIn, signedOut, me, wallet, connecting, configured, signInWithWallet } = useSession();

  if (signedOut) {
    return (
      <View style={{ marginTop: space.md }}>
        <WalletButton
          panel
          header={
            <>
              <Prose weight="semibold">Create an account to boost your rank</Prose>
              <Prose size="label" color={color.walletPanelText} style={{ marginTop: space.xs }}>
                Signed-in requests go first. SKR holders and stakers get bonuses.
              </Prose>
            </>
          }
          label={signInActionLabel({ connecting, walletConnected: wallet !== null })}
          onPress={() => void signInWithWallet()}
          disabled={connecting || !configured}
        />
      </View>
    );
  }

  // Signed in but /api/me not back yet: say nothing rather than guess a tier.
  if (!signedIn || !me) return null;

  const copy = boostCopy({
    tier: normalizeSkrTier(me.account?.skr_tier),
    holderMin: SKR_HOLDER_MIN,
    stakerMin: SKR_STAKER_MIN,
    perks: SKR_PERKS,
  });

  if (copy.kind === "card") {
    return (
      <Card style={{ marginTop: space.md }}>
        <Mono size="label" label tone="muted">
          {copy.heading}
        </Mono>
        {copy.lines.map((line) => (
          <Prose key={line} tone="secondary" style={{ marginTop: space.xs }}>
            {line}
          </Prose>
        ))}
      </Card>
    );
  }

  return (
    <View style={{ marginTop: space.md }}>
      <Prose color={color.accentVerified}>{copy.applied}</Prose>
      {copy.next ? (
        <Prose tone="muted" size="label" style={{ marginTop: space.xs }}>
          {copy.next}
        </Prose>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * "Notify me when it publishes."
 *
 * If this device has a registered push token, the Fulfilment bot (spec §9.2)
 * already covers it and asking for an email would be a second channel for the
 * same event — so the panel says so and offers nothing. Otherwise it collects
 * an address for `PATCH /api/requests/:id {notify_email}`.
 *
 * TWO THINGS THE PANEL NOW HAS TO BE HONEST ABOUT, because that route stopped
 * accepting anonymous writes:
 *
 *   1. It can only submit if this device can prove it owns the request — the
 *      edit token `createRequest` stored, or a session on the owning account.
 *      A request made on another device, or before a reinstall, has neither,
 *      and the panel says so instead of submitting into a 403.
 *   2. Storing the address is not the same as being allowed to mail it. Unless
 *      the caller is signed in and gave their own account email, a confirmation
 *      link goes out and NOTHING is sent until it is followed — so the success
 *      copy is "check your inbox", not "we will email you".
 */
function NotifyPanel({
  requestId,
  signedIn,
  signedOut,
}: {
  requestId: string;
  signedIn: boolean;
  signedOut: boolean;
}) {
  const [pushRegistered, setPushRegistered] = useState<boolean | null>(null);
  const [canEdit, setCanEdit] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void hasRegisteredPushDevice().then((has) => live && setPushRegistered(has));
    return () => {
      live = false;
    };
  }, []);

  // The capability this device holds for this request, if any. A signed-in
  // owner needs none — the route accepts their session instead — and we cannot
  // tell from here whether they are the owner, so the panel offers the form and
  // lets a 403 say otherwise.
  useEffect(() => {
    let live = true;
    void hasRequestEditToken(requestId).then((has) => live && setCanEdit(has || signedIn));
    return () => {
      live = false;
    };
  }, [requestId, signedIn]);

  const onSave = useCallback(async () => {
    setState("saving");
    try {
      const res = await setNotifyEmail(requestId, email);
      setConfirmed(res.confirmed === true);
      setState("saved");
      setMessage(
        res.confirmed === true
          ? null
          : res.confirmation_sent === true || res.throttled === true
            ? "Confirm by email within 24 hours. Nothing is sent until then."
            : "Couldn't send the confirmation. Try again shortly.",
      );
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof ApiError && err.status === 400
          ? "That isn't a valid email address."
          : err instanceof ApiError && err.status === 403
            ? signedIn
              ? "This request belongs to another account."
              : "Only the device or account that made this request can change it."
            : err instanceof ApiError && err.status === 429
              ? "Too many changes today. Try tomorrow."
              : "Couldn't save. Try again.",
      );
    }
  }, [requestId, email, signedIn]);

  if (pushRegistered === null || canEdit === null) return null;

  const onEnablePush = async () => {
    setState("saving");
    const result = await registerForPushNotifications();
    if (result.ok && result.registered) {
      setPushRegistered(true);
      setState("idle");
      return;
    }
    setState("error");
    setMessage(result.ok ? "Push is not connected to your account yet." : result.message);
  };

  if (pushRegistered) {
    return (
      <Card>
        <Mono size="label" label tone="muted">
          Notify me
        </Mono>
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          Push is on. You'll be notified when this publishes.
        </Prose>
      </Card>
    );
  }

  if (!canEdit) {
    // Session still loading: it may yet turn out to be a signed-in owner.
    if (!signedOut) return null;
    return (
      <Card>
        <Mono size="label" label tone="muted">
          Notify me
        </Mono>
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          <SignInLink /> to manage notifications for this request.
        </Prose>
      </Card>
    );
  }

  return (
    <Card>
      <Mono size="label" label tone="muted">
        Notify me when it publishes
      </Mono>
      {signedIn ? (
        <>
          <View style={{ height: space.sm }} />
          <Button
            label={state === "saving" ? "Turning on…" : "Turn on push"}
            tier="primary"
            onPress={() => void onEnablePush()}
            disabled={state === "saving"}
          />
        </>
      ) : null}
      <Prose tone="secondary" style={{ marginTop: space.sm }}>
        {signedIn ? (
          "Or get it by email."
        ) : signedOut ? (
          <>
            Get it by email, or <SignInLink /> for push.
          </>
        ) : (
          "Get it by email."
        )}
      </Prose>
      <View style={{ height: space.sm }} />
      {state === "saved" ? (
        <StatusPill
          label={confirmed ? "we will email you" : "check your inbox to confirm"}
          tone={confirmed ? "verified" : "caution"}
        />
      ) : (
        <>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <View style={{ height: space.sm }} />
          <Button
            label={state === "saving" ? "Saving…" : "Email me"}
            onPress={() => void onSave()}
            disabled={state === "saving" || email.trim().length === 0}
          />
        </>
      )}
      {message ? (
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          {message}
        </Prose>
      ) : null}
    </Card>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString();
}

export default function RequestStatusRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <WhileFocused id={id}>
      <RequestStatusScreen />
    </WhileFocused>
  );
}
