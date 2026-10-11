/**
 * Search (J1). The same /api/search endpoint the website's box uses, so a
 * wallet address or a domain finds the page that mentions it.
 *
 * EMPTY STATE = THE FEED. A search box with nothing typed used to be a blank
 * tab with one explainer card, which is the first thing the app shows and said
 * nothing about a corpus that changes daily. With no query it now renders
 * three sections — what was published or updated most recently, what was
 * decided most recently anywhere, and the web dashboards that go deeper —
 * and they give way to results the moment a character is typed.
 *
 * SINCE YOUR LAST VISIT (Loop 3, docs/RETENTION_LOOPS_SPEC.md §9a). A card
 * above the feed says what happened since the last time this tab was opened —
 * decisions, score moves, pages updated — and lists the pages this phone has
 * read whose record moved since it read them. It is computed on the phone from
 * the two reads below plus markers in src/retention/memory.ts; the server never
 * learns who looked at what, and the card costs no request of its own. A first
 * visit shows no card rather than calling everything "new".
 *
 * WHAT IT COSTS. Two feed requests, once per app session: `/api/v1/investigations`
 * and `/api/v1/activity`, both public, both `s-maxage=300`, so the CDN serves
 * most of them for nothing (web/CLAUDE.md: every request is a billed Vercel
 * invocation). There is NO polling. The result is held in a module-level cache
 * for the life of the process, so switching tabs and coming back costs zero
 * requests; a pull-to-refresh is the one way to ask for fresh rows. The
 * activity read is the shared 50-row window in src/retention/activity-cache.ts
 * — the Watch tab compares against the same copy, so the two tabs cost one
 * request between them, not two.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BandChip,
  Button,
  Card,
  Divider,
  Field,
  Mono,
  Prose,
  Screen,
  border,
  space,
  color,
  QueueLink,
} from "@/src/design";
import { webUrl } from "@/src/api/config";
import { search } from "@/src/api/search";
import { createRequest } from "@/src/api/requests";
import { shouldOfferRequest } from "@/src/search/request-offer";
import { listInvestigations } from "@/src/api/investigations";
import { decisionLabel, type ActivityEvent } from "@/src/api/activity";
import { ApiError } from "@/src/api/client";
import type { InvestigationListItem, SearchSuggestion } from "@/src/api/types";
import { SignInLink, useSession } from "@/src/session";
import { getActivity } from "@/src/retention/activity-cache";
import { homeChanges, type HomeChanges } from "@/src/retention/diff";
import { beginHomeVisit, readAllPages } from "@/src/retention/memory";
import { SinceLastVisitCard } from "@/src/retention/components";
import { relativeTime } from "@/src/retention/time";

const RECENT_LIMIT = 8;
const ACTIVITY_LIMIT = 10;

type Feed = {
  recent: InvestigationListItem[] | null;
  recentError: string | null;
  /** Published pages, from the same cached list response (its `total`). */
  total: number | null;
  /** The full shared window; the section shows the first ACTIVITY_LIMIT. */
  activity: ActivityEvent[] | null;
  activityError: string | null;
  /** Loop 3. Null on a first visit, or when nothing changed. */
  since: HomeChanges | null;
  /** The marker `since` was computed against, kept so it can be recomputed. */
  lastVisit: string | null;
};

/**
 * Session cache. Module scope, not state, so it survives the screen being
 * unmounted when another tab is shown — the feed is worth two requests per app
 * launch, not two per visit. Cleared only by the process ending or a pull.
 */
let feedCache: Feed | null = null;

export default function SearchScreen() {
  const router = useRouter();
  const { signedIn, signedOut } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestNote, setRequestNote] = useState<string | null>(null);
  /** The note is a "received" message with no request id: offer the queue link. */
  const [noteQueued, setNoteQueued] = useState(false);
  /** Set instead of a note when the limit is one that signing in would raise. */
  const [limitNeedsSignIn, setLimitNeedsSignIn] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(feedCache);
  // Decisions on pages that already existed; publishes are in "recently updated".
  const changes = (feed?.activity ?? []).filter((event) => event.decision !== "publish");
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const run = useCallback(async (q: string) => {
    inFlight.current?.abort();
    if (q.trim().length === 0) {
      setResults([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    try {
      const found = await search(q, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError("Search failed. Try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Debounce: one request per 350ms of quiet, not one per keystroke. Every
  // request is a billed invocation even when the CDN absorbs most of them.
  useEffect(() => {
    const timer = setTimeout(() => void run(query), 350);
    return () => clearTimeout(timer);
  }, [query, run]);

  useEffect(() => {
    setRequestNote(null);
    setNoteQueued(false);
    setLimitNeedsSignIn(false);
  }, [query]);

  /**
   * The two feed reads. Neither is allowed to take the other down: a failed
   * half becomes a one-line message in its own section and the other half
   * still renders, because a tab that goes blank on a flaky connection is
   * worse than a tab that says which part is missing.
   */
  const loadFeed = useCallback(async (force = false) => {
    const [recent, activity, lastVisit, readPages] = await Promise.allSettled([
      listInvestigations({ sort: "updated", order: "desc", limit: RECENT_LIMIT, status: "published" }),
      getActivity({ force }),
      beginHomeVisit(),
      readAllPages(),
    ]);

    const recentRows = recent.status === "fulfilled" ? recent.value.investigations : null;
    const activityRows = activity.status === "fulfilled" ? activity.value : null;
    const next: Feed = {
      recent: recentRows,
      total: recent.status === "fulfilled" ? recent.value.total : null,
      recentError: recent.status === "rejected" ? LOAD_FAILED : null,
      activity: activityRows,
      activityError: activity.status === "rejected" ? LOAD_FAILED : null,
      // Only when the feed itself loaded: a comparison against a failed read
      // would report "nothing changed", which is not what happened.
      since:
        activityRows && lastVisit.status === "fulfilled"
          ? homeChanges(
              lastVisit.value,
              activityRows,
              recentRows ?? [],
              readPages.status === "fulfilled" ? readPages.value : {},
            )
          : null,
      lastVisit: lastVisit.status === "fulfilled" ? lastVisit.value : null,
    };
    feedCache = next;
    if (mounted.current) setFeed(next);
  }, []);

  // Once on mount, and only if the session has not already loaded it.
  useEffect(() => {
    mounted.current = true;
    if (!feedCache) void loadFeed();
    return () => {
      mounted.current = false;
    };
  }, [loadFeed]);

  /**
   * Back on this tab after reading one of "your" pages: recompute the card
   * against the phone's fresh page markers, so a page just read drops off it.
   * On-device only — no request.
   */
  useFocusEffect(
    useCallback(() => {
      const current = feedCache;
      if (!current?.activity || !current.lastVisit) return;
      let live = true;
      void readAllPages().then((pages) => {
        if (!live || feedCache !== current) return;
        const since = homeChanges(current.lastVisit, current.activity ?? [], current.recent ?? [], pages);
        feedCache = { ...current, since };
        setFeed(feedCache);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFeed(true);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [loadFeed]);

  /**
   * J4 — nothing matched, so offer to have one made. POST /api/requests has
   * three success shapes and each goes somewhere different: a new row and a
   * dedupe both land on the live status screen, while "already published"
   * means the search simply missed it and the page itself is the answer.
   */
  const onRequest = useCallback(async () => {
    const entity = query.trim();
    if (!entity) return;
    setRequesting(true);
    setRequestNote(null);
    setLimitNeedsSignIn(false);
    try {
      const result = await createRequest(entity);
      if (result.request?.id) {
        router.push(`/request/${result.request.id}`);
        return;
      }
      // A draft is "already being prepared": it has no public page yet, so
      // opening it would land on "Page not found". Say so and point at the queue.
      // `draft` is read defensively; older servers only send the message.
      const isDraft =
        (result as { draft?: boolean }).draft === true ||
        result.message === "This page is already being prepared.";
      if (result.slug && !isDraft) {
        router.push(`/entity/${result.slug}`);
        return;
      }
      setRequestNote(result.message ?? "Request received.");
      setNoteQueued(true);
    } catch (err) {
      // A signed-in caller already has the higher limit, so the remedy that
      // helps an anonymous one is a lie to them.
      if (err instanceof ApiError && err.isRateLimited) {
        if (signedIn) {
          setRequestNote("Daily limit reached. Try again tomorrow.");
        } else {
          setLimitNeedsSignIn(true);
        }
        return;
      }
      setRequestNote("Couldn't send the request. Try again.");
    } finally {
      setRequesting(false);
    }
  }, [query, router, signedIn]);

  const idle = query.trim().length === 0;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={color.textMuted}
          colors={[color.textMuted]}
        />
      }
    >
      {/* One header line in the Screen title style. Its left edge is the
          input's border plus horizontal padding, so it lines up with the text
          typed in the box below. */}
      <Mono
        size="label"
        label
        tone="secondary"
        style={{ marginBottom: space.lg, marginLeft: border.width + space.md }}
      >
        Search
        {feed?.total ? (
          <>
            {" "}
            <Mono size="label" label tone="primary">
              {feed.total.toLocaleString("en-US")}
            </Mono>{" "}
            investigations
          </>
        ) : null}
      </Mono>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Token, site or wallet"
        returnKeyType="search"
        onSubmitEditing={() => void run(query)}
        style={{ borderStyle: "solid", borderRadius: 6 }}
      />

      <View style={{ height: space.lg }} />

      {loading ? <ActivityIndicator color={color.textMuted} /> : null}

      {error ? (
        <Card>
          <Prose tone="secondary">Search failed. Try again.</Prose>
        </Card>
      ) : null}

      {!loading && !error && !idle && results.length === 0 ? (
        <Card>
          <Prose tone="secondary">
            No page for “{query.trim()}” yet. Request one and we&apos;ll investigate it.
          </Prose>
          <View style={{ height: space.md }} />
          <Button
            label={requesting ? "Requesting…" : "Request investigation"}
            tier="primary"
            onPress={() => void onRequest()}
            disabled={requesting}
          />
          {limitNeedsSignIn && signedOut ? (
            <Prose tone="secondary" style={{ marginTop: space.sm }}>
              Daily limit reached. <SignInLink /> for 10 a day.
            </Prose>
          ) : requestNote ? (
            <>
              <Prose tone="secondary" style={{ marginTop: space.sm }}>
                {requestNote}
              </Prose>
              {noteQueued ? <QueueLink url={webUrl("queue")} /> : null}
            </>
          ) : null}
        </Card>
      ) : null}

      {!loading && !error && !idle && results.length > 0 && shouldOfferRequest(query, results) ? (
        <View style={{ alignItems: "flex-end", marginBottom: space.md }}>
          <Pressable
            onPress={() => void onRequest()}
            disabled={requesting}
            accessibilityRole="button"
            accessibilityLabel={`Request an investigation of ${query.trim()}`}
            style={{
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: space.md,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: color.textMuted,
              maxWidth: "100%",
            }}
          >
            <Mono size="micro" tone="secondary" numberOfLines={1}>
              {requesting ? "Requesting…" : `Not here? Request “${query.trim()}”`}
            </Mono>
          </Pressable>
          {limitNeedsSignIn ? (
            <Prose tone="secondary" style={{ marginTop: space.sm }}>
              Daily limit reached. <SignInLink /> for 10 a day.
            </Prose>
          ) : requestNote ? (
            <>
              <Prose tone="secondary" style={{ marginTop: space.sm }}>
                {requestNote}
              </Prose>
              {noteQueued ? <QueueLink url={webUrl("queue")} /> : null}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: space.md }}>
        {results.map((result) => (
          <Pressable
            key={result.slug}
            onPress={() => router.push(`/entity/${result.slug}`)}
            accessibilityRole="link"
          >
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: space.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Prose weight="medium">{result.entity_name}</Prose>
                  <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                    avoid.net/{result.slug}
                  </Mono>
                  {result.matched_entity ? (
                    <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
                      matched {result.matched_entity.kind}: {truncateMiddle(result.matched_entity.value)}
                    </Mono>
                  ) : null}
                </View>
                <BandChip score={result.trust_score} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      {idle ? (
        <View style={{ gap: space.md }}>
          {feed?.since ? (
            <SinceLastVisitCard
              changes={feed.since}
              onOpen={(slug) => router.push(`/entity/${slug}`)}
            />
          ) : null}

          <Section label="Recently updated">
            {feed === null ? (
              <ActivityIndicator color={color.textMuted} />
            ) : feed.recent === null ? (
              <Note>{LOAD_FAILED}</Note>
            ) : feed.recent.length === 0 ? (
              <Note>No pages yet.</Note>
            ) : (
              feed.recent.map((page, index) => (
                <Row
                  key={page.slug}
                  first={index === 0}
                  onPress={() => router.push(`/entity/${page.slug}`)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: space.md,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Prose weight="medium">{page.entity_name}</Prose>
                      <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                        {relativeTime(page.updated_at)}
                      </Mono>
                    </View>
                    <BandChip score={page.trust_score} />
                  </View>
                </Row>
              ))
            )}
          </Section>

          {/* Publishes are left out: a new page is already the top of
              "recently updated", so listing it again here showed the same
              names twice (device test, 2026-10-04). This section is what
              CHANGED on existing pages: fact-checks, evidence decisions and
              score moves. */}
          <Section label="Recent decisions">
            {feed === null ? (
              <ActivityIndicator color={color.textMuted} />
            ) : feed.activity === null ? (
              <Note>{LOAD_FAILED}</Note>
            ) : changes.length === 0 ? (
              <Note>Nothing decided lately.</Note>
            ) : (
              changes.slice(0, ACTIVITY_LIMIT).map((event, index) => (
                <Row
                  key={event.id}
                  first={index === 0}
                  onPress={() => router.push(`/entity/${event.slug}`)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: space.md,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Prose weight="medium">{event.entity_name}</Prose>
                      <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                        {decisionLabel(event.decision)}
                        {scoreMove(event) ? ` · ${scoreMove(event)}` : ""} · {relativeTime(event.created_at)}
                      </Mono>
                    </View>
                    {/* A decision that moved no score gets no chip, rather
                        than a row of "no score" chips saying nothing. */}
                    {event.new_score === null ? null : (
                      <BandChip score={event.new_score} />
                    )}
                  </View>
                </Row>
              ))
            )}
          </Section>
        </View>
      ) : null}
    </Screen>
  );
}

/** A titled card of rows — the house label treatment, once. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card>
      <Mono size="label" label tone="muted" style={{ marginBottom: space.sm }}>
        {label}
      </Mono>
      {children}
    </Card>
  );
}

/** One tappable row inside a Section, hairline-separated from the one above. */
function Row({
  first,
  onPress,
  role = "button",
  children,
}: {
  first: boolean;
  onPress: () => void;
  role?: "button" | "link";
  children: ReactNode;
}) {
  return (
    <View>
      {first ? null : <Divider style={{ marginVertical: space.sm }} />}
      <Pressable
        onPress={onPress}
        accessibilityRole={role}
        style={{ paddingVertical: space.xs }}
      >
        {children}
      </Pressable>
    </View>
  );
}

const LOAD_FAILED = "Couldn't load. Pull down to retry.";

function Note({ children }: { children: ReactNode }) {
  return <Prose tone="muted" size="label">{children}</Prose>;
}

/** "58→46", or null when the decision moved no score (most rejections). */
function scoreMove(event: ActivityEvent): string | null {
  if (event.prev_score === null || event.new_score === null) return null;
  if (event.prev_score === event.new_score) return null;
  return `${Math.round(event.prev_score)}→${Math.round(event.new_score)}`;
}

function truncateMiddle(value: string, keep = 6): string {
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
