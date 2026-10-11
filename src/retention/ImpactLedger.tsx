/**
 * Loop 4 — the impact ledger on Profile (docs/RETENTION_LOOPS_SPEC.md §4,
 * §9a). What your activity CHANGED, not just what you did, and only from data
 * the API actually returns (checked 2026-09-26):
 *
 *   (0.2.5: the reputation progress block, "x of 3 toward Trusted", was
 *   removed; the card is now "Your requests" and your evidence.)
 *   - your requests and their outcomes: `GET /api/requests` when signed in;
 *     otherwise the ids this phone made (src/retention/memory.ts), each read
 *     from the public `GET /api/requests/:id`
 *   - pages you helped publish: requests that ended `fulfilled` with a slug
 *
 * SIGNED IN (0.2.7): the requests, the counter strip and the NEW markers moved
 * to the top of Profile (src/profile/ProfileTop.tsx, which shares
 * `useRequestRows` below). This card keeps evidence with a verdict pill, the
 * recent wallet scans and the links, like avoid.net/me. No new request: requests are the same `GET /api/requests`,
 * evidence and the accepted/rejected tally ride on `/api/me`, and scans come
 * from the once-per-app-session `GET /api/scan` cache the Scan tab shares (if
 * Profile is opened first it makes that one read and Scan reuses it, so the
 * session total is unchanged).
 *
 * YOUR EVIDENCE (2026-10-02): `/api/me` `recent_submissions` carries the last
 * 20 submissions with verdict, reason and score move; no extra request. An
 * older server omits the field, and the ledger then falls back to the link to
 * avoid.net/me for the list rather than inventing one.
 *
 * COST: at most one `GET /api/requests` per Profile visit when signed in, or up
 * to five public request reads for the most recent requests this phone made.
 * Reused for five minutes; no polling. The cache is dropped whenever the
 * signed-in person changes (resetImpactLedger, called by the session
 * provider), so one account's requests never show under another.
 *
 * GUARDRAILS (§7): no streaks, nothing framed as something to lose.
 */
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { BandChip, Card, Divider, Mono, Prose, StatusPill, color, space } from "@/src/design";
import { getRequest, isRequestTerminal, listMyRequests } from "@/src/api/requests";
import type { InvestigationRequest, RecentSubmission, ScanHistoryRow } from "@/src/api/types";
import { webUrl } from "@/src/api/config";
import { listDeviceRequests } from "./memory";
import { relativeTime } from "./time";
import { requestsVersion } from "./ledger-cache";
import { resetUnreadAlerts } from "@/src/profile/profile-store";
import type { RequestRow } from "@/src/profile/requests-view";
import { getScanHistory } from "./scan-history";
import { evidenceOutcome, scoreMoveText, tokenCountText } from "./evidence";

/** Unresolved requests this phone checks on, at most, per Profile visit. */
const MAX_DEVICE_LOOKUPS = 5;
const MAX_ROWS = 6;

type Row = RequestRow;

/**
 * Rows are reused for five minutes, so hopping between tabs costs nothing,
 * while a request made from Search a minute ago still appears when the user
 * comes back to Profile later.
 */
const CACHE_MS = 5 * 60_000;
let sessionCache: { key: string; rows: Row[]; at: number; version: number } | null = null;

function cacheFresh(key: string): boolean {
  return (
    sessionCache !== null &&
    sessionCache.key === key &&
    sessionCache.version === requestsVersion() &&
    Date.now() - sessionCache.at < CACHE_MS
  );
}

/** Called by the session provider when the signed-in person changes. */
export function resetImpactLedger(): void {
  sessionCache = null;
  inflight.clear();
  resetUnreadAlerts();
}

/** One fetch in flight per key, shared by ProfileTop and ImpactLedger. */
const inflight = new Map<string, Promise<Row[]>>();

function loadRows(signedIn: boolean): Promise<Row[]> {
  const key = signedIn ? "account" : "device";
  if (cacheFresh(key) && sessionCache) return Promise.resolve(sessionCache.rows);
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = fetchRows(signedIn, key).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function fetchRows(signedIn: boolean, key: string): Promise<Row[]> {
  const startedAt = requestsVersion();

  let rows: Row[];
  if (signedIn) {
    const requests = await listMyRequests();
    // Newest first, whatever order the server used.
    rows = requests.map(toRow).sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  } else {
    const device = await listDeviceRequests();
    const looked = await Promise.all(
      device.slice(0, MAX_DEVICE_LOOKUPS).map((r) =>
        getRequest(r.id)
          .then(toRow)
          .catch(() => ({ id: r.id, entity: r.entity, status: "unknown", slug: null, created_at: r.created_at })),
      ),
    );
    rows = looked;
  }
  sessionCache = { key, rows, at: Date.now(), version: startedAt };
  return rows;
}

function toRow(r: InvestigationRequest): Row {
  return {
    id: r.id,
    entity: r.entity_name ?? r.slug ?? "request",
    status: r.status,
    slug: r.slug ?? null,
    created_at: r.created_at,
    page_trust_score: r.page_trust_score ?? null,
    page_entity_name: r.page_entity_name ?? null,
    published_at: r.published_at ?? null,
    queue_position: r.queue_position ?? null,
  };
}

/**
 * Opens a link and swallows the rejection: with no browser or X app to take
 * it `Linking.openURL` rejects, and an unhandled rejection is a dead tap.
 */
export function openExternal(url: string): void {
  Linking.openURL(url).catch((err) => console.warn("[profile] could not open", url, err));
}

/** A footer link a thumb can hit: 44px tall, with slop around the text. */
const linkTarget = { minHeight: 44, justifyContent: "center", paddingVertical: space.sm } as const;
const linkHitSlop = { top: 8, bottom: 8, left: 12, right: 12 } as const;

/**
 * One row per wallet, the most recent scan of each. The server keeps every
 * scan, so scanning the same wallet twice listed it twice.
 */
export function distinctWalletScans(scans: ScanHistoryRow[]): ScanHistoryRow[] {
  const when = (s: ScanHistoryRow) => Date.parse(s.completed_at ?? s.created_at) || 0;
  const latest = new Map<string, ScanHistoryRow>();
  for (const s of scans) {
    const seen = latest.get(s.address);
    if (!seen || when(s) > when(seen)) latest.set(s.address, s);
  }
  return [...latest.values()].sort((a, b) => when(b) - when(a));
}

/**
 * Opens the X profile. Android hands an x.com link to the X app when it is
 * installed and to the browser otherwise, so no native library is needed.
 * Styled like "All submissions on avoid.net ↗".
 */
export function FollowOnXLink() {
  return (
    <Pressable
      onPress={() => openExternal("https://x.com/0xavoid")}
      accessibilityRole="link"
      hitSlop={linkHitSlop}
      style={[linkTarget, { marginTop: space.xs }]}
    >
      <Mono size="micro" tone="secondary">
        Follow @0xavoid on X ↗
      </Mono>
    </Pressable>
  );
}

function shortAddress(value: string, keep = 6): string {
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

/**
 * The account's (or this phone's) request rows, newest first. Tabs stay
 * mounted, so a mount-only effect never saw a request made after Profile
 * first rendered: re-check on every focus. A fresh cache answers for free, a
 * stale or invalidated one costs one GET /api/requests.
 */
export function useRequestRows(signedIn: boolean): { rows: Row[] | null; error: string | null } {
  const [rows, setRows] = useState<Row[] | null>(
    sessionCache?.key === (signedIn ? "account" : "device") ? sessionCache.rows : null,
  );
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadRows(signedIn)
        .then((r) => {
          if (!live) return;
          setError(null);
          setRows(r);
        })
        .catch((err) => live && setError(err instanceof Error ? err.message : String(err)));
      return () => {
        live = false;
      };
    }, [signedIn]),
  );
  return { rows, error };
}

export function ImpactLedger({
  signedIn,
  submissions,
  onOpenPage,
  onOpenRequest,
  onOpenScan,
}: {
  signedIn: boolean;
  /** `/api/me` recent_submissions; undefined on an older server. */
  submissions?: RecentSubmission[];
  onOpenPage: (slug: string) => void;
  onOpenRequest: (id: string) => void;
  /** Opens the Scan tab with this address filled in. */
  onOpenScan?: (address: string) => void;
}) {
  const { rows, error } = useRequestRows(signedIn);
  const [scans, setScans] = useState<ScanHistoryRow[]>([]);

  // Session-cached and shared with the Scan tab: no extra request per visit.
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    getScanHistory()
      .then((s) => live && setScans(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn]);

  const published = (rows ?? []).filter((r) => r.status === "fulfilled" && r.slug);
  const pending = (rows ?? []).filter((r) => !isRequestTerminal(r.status) && r.status !== "unknown");

  // Nothing to show a signed-out visitor who has never asked for anything.
  if (!signedIn && rows !== null && rows.length === 0) return null;

  if (signedIn) {
    const doneScans = distinctWalletScans(scans.filter((s) => s.status !== "failed"));
    return (
      <Card style={{ marginTop: space.lg }}>
        {submissions && submissions.length > 0 ? (
          <>
            <Mono size="micro" label tone="muted">
              Your evidence · {submissions.length}
            </Mono>
            {submissions.slice(0, MAX_ROWS).map((s) => {
              const move = scoreMoveText(s);
              const out = evidenceOutcome(s.status);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => (s.slug ? onOpenPage(s.slug) : undefined)}
                  disabled={!s.slug}
                  accessibilityRole={s.slug ? "link" : undefined}
                  style={{ paddingVertical: space.xs, marginTop: space.xs }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: space.md,
                    }}
                  >
                    <Prose weight="medium" style={{ flex: 1 }}>
                      {s.entity_name ?? s.slug ?? "a page"}
                    </Prose>
                    <StatusPill label={out.label} tone={out.tone} />
                  </View>
                  <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                    {relativeTime(s.resolved_at ?? s.created_at)}
                    {move ? ` · ${move}` : ""}
                  </Mono>
                  {s.decision_reason ? (
                    <Prose tone="secondary" size="label" style={{ marginTop: 2 }}>
                      {s.decision_reason}
                    </Prose>
                  ) : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {/* Hidden when there are none (or the read failed): never an empty box. */}
        {doneScans.length > 0 && onOpenScan ? (
          <>
            {submissions && submissions.length > 0 ? <Divider style={{ marginVertical: space.md }} /> : null}
            <Mono size="micro" label tone="muted">
              Your wallet scans · {doneScans.length}
            </Mono>
            {doneScans.slice(0, MAX_ROWS).map((s) => {
              const tokens = tokenCountText(s.position_count);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onOpenScan(s.address)}
                  accessibilityRole="link"
                  accessibilityHint="Opens Scan with this wallet filled in"
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
                    <Mono size="body">{shortAddress(s.address)}</Mono>
                    <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                      {tokens ? `${tokens} · ` : ""}
                      {relativeTime(s.completed_at ?? s.created_at)}
                    </Mono>
                  </View>
                  {s.risk_score != null ? <BandChip score={s.risk_score} /> : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        <Pressable
          onPress={() => openExternal(webUrl("me"))}
          accessibilityRole="link"
          hitSlop={linkHitSlop}
          style={[linkTarget, { marginTop: space.xs }]}
        >
          <Mono size="micro" tone="secondary">
            All submissions on avoid.net ↗
          </Mono>
        </Pressable>
        <FollowOnXLink />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: space.lg }}>
      {rows === null && !error ? (
        <View style={{ marginTop: space.md }}>
          <ActivityIndicator color={color.textMuted} />
        </View>
      ) : null}
      {error ? (
        <Prose tone="muted" size="label" style={{ marginTop: space.sm }}>
          Couldn't load your requests.
        </Prose>
      ) : null}

      {rows !== null ? (
        <>
          <Mono size="label" label tone="muted">
            {published.length > 0 ? `Your requests · ${published.length}` : "Your requests"}
          </Mono>
          {published.length === 0 ? (
            <Prose tone="secondary" style={{ marginTop: space.xs }}>
              {"None yet. Published requests appear here."}
            </Prose>
          ) : (
            published.slice(0, MAX_ROWS).map((row) => (
              <Pressable
                key={row.id}
                onPress={() => onOpenPage(row.slug as string)}
                accessibilityRole="link"
                style={{ paddingVertical: space.xs, marginTop: space.xs }}
              >
                <Prose weight="medium">{row.entity}</Prose>
                <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                  requested {relativeTime(row.created_at)} →
                </Mono>
              </Pressable>
            ))
          )}

          {pending.length > 0 ? (
            <>
              <Divider style={{ marginVertical: space.md }} />
              <Mono size="micro" label tone="muted">
                Waiting · {pending.length}
              </Mono>
              {pending.slice(0, MAX_ROWS).map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => onOpenRequest(row.id)}
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
                    <Prose>{row.entity}</Prose>
                    <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                      requested {relativeTime(row.created_at)}
                    </Mono>
                  </View>
                  <StatusPill
                    label={row.status === "running" ? "investigating" : row.status}
                    tone={row.status === "running" ? "caution" : "neutral"}
                  />
                </Pressable>
              ))}
            </>
          ) : null}
        </>
      ) : null}

    </Card>
  );
}
