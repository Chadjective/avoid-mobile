/**
 * The top of the signed-in Profile: who you are, what became of your
 * requests, and four numbers that open the tabs they count.
 *
 * DATA SOURCES (no new endpoint, no per-row fetch):
 *   handle, SEEKER / SKR badges  GET /api/me (session)
 *   published / in-queue counts  GET /api/requests (shared with the ledger via
 *                                useRequestRows; refreshed on focus)
 *   next run                     the published drain schedule
 *                                (src/retention/queue-schedule.ts)
 *   Following                    the shared watchlist store (GET /api/v1/watchlist)
 *   New alerts                   GET /api/v1/feed rows newer than the Alerts
 *                                tab's last-visit marker (cached five minutes)
 *   Wallet scans                 the once-per-session GET /api/scan cache
 *   Evidence                     /api/me recent_submissions + rep tally
 *   NEW marker                   on-device set of acknowledged published ids
 *
 * Published rows show the page's score + band chip when GET /api/requests
 * sends page_trust_score (older servers omit it: the PUBLISHED pill is the
 * fallback). page_entity_name, published_at and queue_position likewise.
 * NEW is the acknowledged-ids set only (published_at is not compared with a
 * visit time; see newPublished).
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { BandChip, Card, Divider, Mono, Prose, StatusPill, color, space } from "@/src/design";
import { webUrl } from "@/src/api/config";
import { requestOutcome } from "@/src/retention/evidence";
import { openExternal, distinctWalletScans, useRequestRows } from "@/src/retention/ImpactLedger";
import { nextDrainAt } from "@/src/retention/queue-schedule";
import { getScanHistory } from "@/src/retention/scan-history";
import { relativeTime } from "@/src/retention/time";
import { useWatchlist } from "@/src/retention/watchlist-store";
import type { ScanHistoryRow } from "@/src/api/types";
import { acknowledgePublished, getUnreadAlerts, readSeenPublished, writeSeenPublished } from "./profile-store";
import {
  collapse,
  evidenceCount,
  formatUtcTime,
  groupRequests,
  moreLabel,
  publishedSubline,
  rowDisplayName,
  rowScore,
  newPublished,
  queueSubline,
  type RequestRow,
} from "./requests-view";

export type ProfileTab = "watchlist" | "alerts" | "scan";

export function ProfileTop(props: {
  handle: string | null;
  seekerVerified: boolean;
  skrTier: string;
  submissions?: unknown[];
  rep: { acceptedCount: number; rejectedCount: number } | null;
  onOpenPage: (slug: string) => void;
  onOpenRequest: (id: string) => void;
  onOpenTab: (tab: ProfileTab) => void;
}) {
  const { rows, error } = useRequestRows(true);
  const groups = groupRequests(rows ?? []);
  const [queueOpen, setQueueOpen] = useState(false);
  const [publishedOpen, setPublishedOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);

  // ---- NEW markers ---------------------------------------------------------
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const publishedKey = groups.published.map((r) => r.id).join(",");
  useEffect(() => {
    if (rows === null) return;
    let live = true;
    void (async () => {
      const ids = publishedKey ? publishedKey.split(",") : [];
      const result = newPublished(ids, await readSeenPublished());
      if (result.baseline) await writeSeenPublished(result.baseline);
      if (live) setNewIds(result.newIds);
    })();
    return () => {
      live = false;
    };
  }, [rows, publishedKey]);

  const openPublished = useCallback(
    (row: RequestRow) => {
      setNewIds((prev) => {
        if (!prev.has(row.id)) return prev;
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      void acknowledgePublished(row.id);
      props.onOpenPage(row.slug as string);
    },
    [props],
  );

  // ---- strip numbers -------------------------------------------------------
  const watchlist = useWatchlist(true);
  const [scans, setScans] = useState<ScanHistoryRow[] | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    getScanHistory()
      .then((s) => live && setScans(s))
      .catch(() => {});
    void getUnreadAlerts().then((n) => live && setUnread(n));
    return () => {
      live = false;
    };
  }, []);
  const scanCount = scans ? distinctWalletScans(scans.filter((s) => s.status !== "failed")).length : null;

  const skr = props.skrTier === "holder" || props.skrTier === "staker" ? props.skrTier : null;
  const nextRun = formatUtcTime(nextDrainAt());

  return (
    <View style={{ marginBottom: space.lg }}>
      {/* One identity line: handle with the badges on the same row. */}
      {props.handle ? (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm }}>
          <Prose weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
            @{props.handle}
          </Prose>
          {props.seekerVerified ? <StatusPill label="SEEKER" tone="verified" /> : null}
          {skr ? <StatusPill label={`SKR ${skr}`} tone="neutral" /> : null}
        </View>
      ) : null}

      {/* Two tiles. */}
      <View style={{ flexDirection: "row", gap: space.md, marginTop: space.md }}>
        <Tile
          value={rows === null ? "–" : String(groups.published.length)}
          valueColor={color.accentVerified}
          text="published from your requests"
        />
        <Tile
          value={rows === null ? "–" : String(groups.queue.length)}
          text={`in the queue · next run ${nextRun}`}
        />
      </View>

      {rows === null && !error ? (
        <View style={{ marginTop: space.md }}>
          <ActivityIndicator color={color.textMuted} />
        </View>
      ) : null}
      {error ? (
        <Prose tone="muted" size="label" style={{ marginTop: space.md }}>
          Couldn't load your requests.
        </Prose>
      ) : null}

      {groups.queue.length > 0 ? (
        <RequestList
          label="In the queue"
          rows={groups.queue}
          expanded={queueOpen}
          onToggle={() => setQueueOpen((v) => !v)}
          onPress={(r) => props.onOpenRequest(r.id)}
          subline={(r) => queueSubline(r, relativeTime(r.created_at), r.queue_position)}
        />
      ) : null}

      {groups.published.length > 0 ? (
        <RequestList
          label="Published"
          rows={groups.published}
          expanded={publishedOpen}
          onToggle={() => setPublishedOpen((v) => !v)}
          onPress={openPublished}
          subline={(r) => publishedSubline(r, relativeTime(r.published_at), relativeTime(r.created_at))}
          isNew={(r) => newIds.has(r.id)}
        />
      ) : null}

      {groups.other.length > 0 ? (
        <RequestList
          label="Not published"
          rows={groups.other}
          expanded={otherOpen}
          onToggle={() => setOtherOpen((v) => !v)}
          onPress={(r) => props.onOpenRequest(r.id)}
          subline={(r) => `requested ${relativeTime(r.created_at)}`}
        />
      ) : null}

      {rows !== null && rows.length === 0 ? (
        <Prose tone="secondary" style={{ marginTop: space.md }}>
          None yet. Requests you make appear here.
        </Prose>
      ) : null}

      {/* Four numbers, each a door to the thing it counts. */}
      <Card style={{ marginTop: space.md, paddingVertical: space.md }}>
        <View style={{ flexDirection: "row" }}>
          <StripCell
            value={watchlist.items ? watchlist.items.length : null}
            label="Following"
            hint="Opens Watch"
            onPress={() => props.onOpenTab("watchlist")}
          />
          {unread !== null ? (
            <StripCell
              value={unread}
              label="New alerts"
              hint="Opens Alerts"
              onPress={() => props.onOpenTab("alerts")}
            />
          ) : null}
          <StripCell
            value={scanCount}
            label="Wallet scans"
            hint="Opens Scan"
            onPress={() => props.onOpenTab("scan")}
          />
          <StripCell
            value={evidenceCount(props.submissions, props.rep)}
            label="Evidence"
            hint="Opens avoid.net/me"
            onPress={() => openExternal(webUrl("me"))}
          />
        </View>
      </Card>
    </View>
  );
}

function Tile(props: { value: string; text: string; valueColor?: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Mono size="display" weight="semibold" color={props.valueColor}>
        {props.value}
      </Mono>
      <Mono size="micro" tone="secondary" style={{ marginTop: space.xs }}>
        {props.text}
      </Mono>
    </Card>
  );
}

function StripCell(props: { value: number | null; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${props.value ?? "unknown"} ${props.label}`}
      accessibilityHint={props.hint}
      style={{ flex: 1, alignItems: "center", minHeight: 44, justifyContent: "center" }}
    >
      <Mono size="body" weight="medium">
        {props.value === null ? "–" : props.value}
      </Mono>
      <Mono size="micro" tone="muted" style={{ marginTop: 2, textAlign: "center" }}>
        {props.label}
      </Mono>
    </Pressable>
  );
}

function RequestList(props: {
  label: string;
  rows: RequestRow[];
  expanded: boolean;
  onToggle: () => void;
  onPress: (row: RequestRow) => void;
  subline: (row: RequestRow) => string;
  isNew?: (row: RequestRow) => boolean;
}) {
  const { shown, more } = collapse(props.rows, props.expanded);
  return (
    <Card style={{ marginTop: space.md }}>
      <Mono size="label" label tone="muted">
        {props.label}
      </Mono>
      {shown.map((row, i) => {
        const out = requestOutcome(row.status);
        const score = row.status === "fulfilled" && row.slug ? rowScore(row) : null;
        const isNew = props.isNew?.(row) === true;
        return (
          <View key={row.id}>
            {i > 0 ? <Divider style={{ marginVertical: space.xs }} /> : null}
            <Pressable
              onPress={() => props.onPress(row)}
              accessibilityRole="link"
              style={{
                paddingVertical: space.xs,
                marginTop: space.xs,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: space.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Prose weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {rowDisplayName(row)}
                  </Prose>
                  {isNew ? <NewTag /> : null}
                </View>
                <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                  {props.subline(row)}
                </Mono>
              </View>
              {score !== null ? <BandChip score={score} /> : <StatusPill label={out.label} tone={out.tone} />}
            </Pressable>
          </View>
        );
      })}
      {more > 0 || props.expanded ? (
        <Pressable
          onPress={props.onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: props.expanded }}
          style={{ minHeight: 44, justifyContent: "center", marginTop: space.xs }}
        >
          <Mono size="micro" tone="secondary">
            {props.expanded ? "Show fewer" : moreLabel(more)}
          </Mono>
        </Pressable>
      ) : null}
    </Card>
  );
}

function NewTag() {
  return (
    <View
      accessible
      accessibilityLabel="new, not opened yet"
      style={{
        borderWidth: 1,
        borderColor: color.accentVerified,
        borderRadius: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
      }}
    >
      <Mono size="micro" label color={color.accentVerified}>
        new
      </Mono>
    </View>
  );
}
