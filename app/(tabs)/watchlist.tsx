/**
 * Watchlist (J3). Follow an entity or an address; the botfleet turns a change
 * into a push.
 *
 * LEADS WITH WHAT MOVED (Loop 2, docs/RETENTION_LOOPS_SPEC.md §9a). The first
 * card lists each followed page whose score changed, or that had a decision,
 * since this tab was last opened — each linking to the page, whose audit
 * trail holds the reason. It compares the watchlist's current scores with the
 * snapshot this phone kept last time, plus the shared activity window
 * (src/retention/activity-cache.ts), so it adds no request of its own.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import {
  BandChip,
  Card,
  Mono,
  Prose,
  Screen,
  StatusPill,
  color,
  space,
} from "@/src/design";
import { type WatchlistItem } from "@/src/api/watchlist";
import { PAGE_TRUST_BAND_LABELS, type PageTrustBand } from "@/src/design/bands";
import { ApiError } from "@/src/api/client";
import { SignInLink, useSession } from "@/src/session";
import { getActivity } from "@/src/retention/activity-cache";
import { watchMoves, type WatchMove } from "@/src/retention/diff";
import { previousWatchSnapshot, rememberWatch } from "@/src/retention/memory";
import { WhatMovedCard } from "@/src/retention/components";
import { relativeTime } from "@/src/retention/time";
import { AddButton } from "@/src/watch/AddButton";
import { metaLine, riskLine, scoreMovedLine } from "@/src/watch/format";
import { setItemMuted, unfollowItem, useWatchlist } from "@/src/retention/watchlist-store";

export default function WatchlistScreen() {
  const router = useRouter();
  const { signedIn, signedOut } = useSession();
  const watchlist = useWatchlist(signedIn);
  const items = watchlist.items ?? (watchlist.error ? [] : null);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (watchlist.error ? describeError(watchlist.error) : null);
  const [refreshing, setRefreshing] = useState(false);
  /** undefined until computed; `firstVisit` when there was no snapshot. */
  const [moved, setMoved] = useState<{
    since: string | null;
    moves: WatchMove[];
    firstVisit: boolean;
    /** How complete the decision half of the comparison is. */
    activity: "ok" | "unavailable" | "partial";
  }>();

  // Compare once the list is here, then store today's scores for next time.
  const compare = useCallback(async (list: WatchlistItem[], force: boolean) => {
    const pages = list
      .filter((i) => i.target_kind === "investigation" && i.slug)
      .map((i) => ({
        slug: i.slug as string,
        entity_name: i.entity_name ?? (i.slug as string),
        trust_score: i.trust_score ?? null,
      }));
    const [previous, activity] = await Promise.all([
      previousWatchSnapshot(),
      getActivity({ force }).catch(() => null),
    ]);
    const since = previous?.seenAt ?? null;
    // The window is 50 decisions across the whole corpus. If every one of
    // them is newer than the last visit, older decisions on a follow may
    // have fallen out of it — so the card must not claim "nothing changed".
    const saturated =
      activity !== null &&
      since !== null &&
      activity.length > 0 &&
      activity.every((e) => Date.parse(e.created_at) > Date.parse(since));
    setMoved({
      since,
      moves: watchMoves(previous, pages, activity ?? []),
      firstVisit: previous === null,
      activity: activity === null ? "unavailable" : saturated ? "partial" : "ok",
    });
    await rememberWatch(Object.fromEntries(pages.map((p) => [p.slug, p.trust_score])));
  }, []);

  useEffect(() => {
    if (watchlist.items && moved === undefined) void compare(watchlist.items, false);
  }, [watchlist.items, moved, compare]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      await Promise.all([watchlist.refresh(), getActivity({ force: true }).catch(() => null)]);
      setMoved(undefined); // recompute against the same snapshot, fresh data
    } finally {
      setRefreshing(false);
    }
  }, [watchlist]);

  const act = (work: Promise<unknown>) =>
    void work.then(() => setActionError(null)).catch((err) => setActionError(describeError(err)));

  if (!signedIn) {
    // Session still loading: show nothing rather than a prompt to sign in.
    if (!signedOut) return <Screen title="watchlist">{null}</Screen>;
    return (
      <Screen title="watchlist">
        <Card>
          <Prose tone="secondary">
            <SignInLink /> to follow pages and wallets.
          </Prose>
        </Card>
      </Screen>
    );
  }

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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: space.lg,
        }}
      >
        <Mono size="label" label tone="muted">
          Watchlist{items ? ` · ${items.length}` : ""}
        </Mono>
        <AddButton onPress={() => router.push("/watch-add")} label="Add to watchlist" />
      </View>

      {items === null ? <ActivityIndicator color={color.textMuted} /> : null}

      {items && items.length > 0 && moved ? (
        <WhatMovedCard
          since={moved.since}
          moves={moved.moves}
          firstVisit={moved.firstVisit}
          empty={items.length === 0}
          activity={moved.activity}
          onOpen={(slug) => router.push(`/entity/${slug}`)}
        />
      ) : null}

      {error ? (
        <Card style={{ marginBottom: space.lg }}>
          <Prose tone="secondary">{error}</Prose>
        </Card>
      ) : null}

      {items !== null && items.length === 0 && !error ? (
        <Card>
          <Prose tone="secondary">
            Nothing followed yet. Tap + to search, or Follow on any page.
          </Prose>
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        {(items ?? []).map((item) => (
          <WatchRow
            key={item.id}
            item={item}
            onOpen={(slug) => router.push(`/entity/${slug}`)}
            act={act}
          />
        ))}
      </View>
    </Screen>
  );
}

function WatchRow({
  item,
  onOpen,
  act,
}: {
  item: WatchlistItem;
  onOpen: (slug: string) => void;
  act: (work: Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const name = item.entity_name ?? item.slug ?? item.address ?? "unknown";
  const meta =
    item.target_kind === "address"
      ? ["wallet", item.created_at ? `since ${relativeTime(item.created_at)}` : ""].filter(Boolean).join(" · ")
      : metaLine(item);
  const risk = riskLine(item);
  const movedWhen = item.score_moved_at ? relativeTime(item.score_moved_at) : "";
  const moved = scoreMovedLine(movedWhen, item.previous_score, item.trust_score);

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => item.slug && onOpen(item.slug)}
          disabled={!item.slug}
          accessibilityRole="link"
        >
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
            <Prose weight="medium">{name}</Prose>
            {item.band ? (
              <>
                {typeof item.trust_score === "number" ? (
                  <Mono size="body" tone="secondary">
                    {item.trust_score}
                  </Mono>
                ) : null}
                <StatusPill label={PAGE_TRUST_BAND_LABELS[item.band]} tone={toneForBand(item.band)} />
              </>
            ) : (
              // BandChip prints its own number.
              <BandChip score={item.trust_score} />
            )}
          </View>
          {meta || item.muted ? (
            <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
              {[meta, item.muted ? "muted" : ""].filter(Boolean).join(" · ")}
            </Mono>
          ) : null}
          {risk ? (
            <Prose tone="secondary" style={{ marginTop: 2 }}>
              {risk}
            </Prose>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? `Collapse ${name}` : `Expand ${name}`}
          accessibilityState={{ expanded: open }}
          hitSlop={8}
        >
          <Mono size="body" tone="muted">
            {open ? "[−]" : "[+]"}
          </Mono>
        </Pressable>
      </View>
      {open ? (
        <View style={{ marginTop: space.md, gap: space.sm }}>
          {moved ? (
            <Mono size="micro" tone="muted">
              {moved}
            </Mono>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.lg, flexWrap: "wrap" }}>
            {item.slug ? (
              <ActionLink label="Open page" onPress={() => onOpen(item.slug as string)} />
            ) : null}
            <ActionLink
              label={item.muted ? "Unmute alerts" : "Mute alerts"}
              onPress={() => act(setItemMuted(item.id, !item.muted))}
            />
            <ActionLink label="Unfollow" onPress={() => act(unfollowItem(item.id))} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function ActionLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ paddingVertical: space.xs }}>
      <Mono size="micro" tone="secondary" label>
        {label}
      </Mono>
    </Pressable>
  );
}

function toneForBand(band: PageTrustBand) {
  switch (band) {
    case "CRITICAL":
      return "critical" as const;
    case "WARNING":
      return "warning" as const;
    case "CAUTIONARY":
      return "caution" as const;
    default:
      return "verified" as const;
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) return "Offline — pull down to try again.";
  if (err instanceof ApiError && err.status === 403) {
    return "Pick a handle on the Profile tab to finish setting up your account.";
  }
  return "Couldn't update. Pull down to retry.";
}
