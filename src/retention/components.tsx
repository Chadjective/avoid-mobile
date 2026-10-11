/**
 * The on-screen half of the retention loops (docs/RETENTION_LOOPS_SPEC.md
 * §4, §9a). Each component renders a comparison from ./diff.ts and nothing
 * else — they fetch nothing, so dropping one onto a screen costs no request.
 *
 * Copy rules (spec §7 and MOBILE_APP_SPEC §6 rule 5): scores and statuses
 * only. "score 61 → 49", "1 accepted evidence", "1 fact-check verdict" —
 * never a word about what the entity did. Every change links to the page,
 * where the audit trail holds the reason.
 */
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import {
  BandChip,
  Card,
  Divider,
  Mono,
  Prose,
  bandForPageScore,
  color,
  space,
} from "@/src/design";
import { decisionLabel } from "@/src/api/activity";
import { scanDiffIsEmpty, type HomeChanges, type PageChanges, type ScanDiff, type ScoreMove, type WatchMove } from "./diff";
import { relativeTime } from "./time";

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

/** "61 → 49", plus "· CAUTIONARY → WARNING" when the move crossed a band. */
export function scoreMoveText(move: ScoreMove): string {
  const from = bandForPageScore(move.from).label;
  const to = bandForPageScore(move.to).label;
  return from === to ? `${move.from} → ${move.to}` : `${move.from} → ${move.to} · ${from} → ${to}`;
}

/** The marker on a row that is newer than the reader's last look. */
export function NewMarker() {
  return (
    <View
      accessible
      accessibilityLabel="new since your last visit"
      style={{
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: color.textSecondary,
        borderRadius: 2,
        paddingHorizontal: 4,
        paddingVertical: 1,
        alignSelf: "flex-start",
      }}
    >
      <Mono size="micro" label tone="primary">
        new
      </Mono>
    </View>
  );
}

function scoreMoveOf(from: number | null | undefined, to: number | null | undefined): ScoreMove | null {
  if (typeof from !== "number" || typeof to !== "number") return null;
  if (Math.round(from) === Math.round(to)) return null;
  return { from: Math.round(from), to: Math.round(to) };
}

function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Line({ children }: { children: ReactNode }) {
  return (
    <Mono size="micro" tone="secondary" style={{ marginTop: 4 }}>
      {children}
    </Mono>
  );
}

// ---------------------------------------------------------------------------
// Loop 3 — the Search tab
// ---------------------------------------------------------------------------

const MAX_YOURS = 5;
/** Rows listed per group when the card is expanded; the rest is a count. */
const MAX_LISTED = 10;

export function SinceLastVisitCard({
  changes,
  onOpen,
}: {
  changes: HomeChanges;
  onOpen: (slug: string) => void;
}) {
  const count = changes.saturated ? `${changes.decisions}+` : String(changes.decisions);
  const summary = [
    changes.decisions > 0
      ? `${count} ${changes.decisions === 1 ? "decision" : "decisions"} on ${plural(changes.pagesTouched, "page")}`
      : null,
    changes.scoreMoves > 0 ? plural(changes.scoreMoves, "score move") : null,
    changes.pagesUpdated > 0 ? `${plural(changes.pagesUpdated, "page")} updated` : null,
  ].filter(Boolean);

  const yours = changes.yours.slice(0, MAX_YOURS);
  const [open, setOpen] = useState(false);
  const expandable = changes.decisionEvents.length > 0 || changes.updatedPages.length > 0;
  const events = changes.decisionEvents.slice(0, MAX_LISTED);
  const pages = changes.updatedPages.slice(0, MAX_LISTED);

  return (
    <Card style={{ borderColor: color.textMuted }}>
      <Pressable
        disabled={!expandable}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Since you were here ${relativeTime(changes.since)}. ${summary.join(", ")}`}
        accessibilityHint={open ? "Hide the updates" : "Show the updates"}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Mono size="label" label tone="muted">
            Since you were here {relativeTime(changes.since)}
          </Mono>
          {expandable ? (
            <Mono size="label" tone="secondary">
              {open ? "[−]" : "[+]"}
            </Mono>
          ) : null}
        </View>
        {summary.length > 0 ? (
          <Prose tone="primary" style={{ marginTop: space.sm }}>
            {summary.join(" · ")}
          </Prose>
        ) : null}
      </Pressable>

      {open ? (
        <>
          {events.length > 0 ? (
            <>
              <Divider style={{ marginVertical: space.sm }} />
              <Mono size="micro" label tone="muted">
                Decisions
              </Mono>
              {events.map((e) => {
                const move = scoreMoveOf(e.prev_score, e.new_score);
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => onOpen(e.slug)}
                    accessibilityRole="link"
                    accessibilityHint="Opens the page"
                    style={{ paddingVertical: space.xs, marginTop: space.xs }}
                  >
                    <Prose weight="medium">{e.entity_name}</Prose>
                    <Mono size="micro" tone="secondary" style={{ marginTop: 2 }}>
                      {decisionLabel(e.decision)}
                      {move ? ` · score ${scoreMoveText(move)}` : ""} · {relativeTime(e.created_at)}
                    </Mono>
                  </Pressable>
                );
              })}
              {changes.decisionEvents.length > events.length ? (
                <Line>and {changes.decisionEvents.length - events.length} more</Line>
              ) : null}
              {changes.saturated ? <Line>The feed shows only the latest decisions.</Line> : null}
            </>
          ) : null}
          {pages.length > 0 ? (
            <>
              <Divider style={{ marginVertical: space.sm }} />
              <Mono size="micro" label tone="muted">
                Pages updated
              </Mono>
              {pages.map((p) => (
                <Pressable
                  key={p.slug}
                  onPress={() => onOpen(p.slug)}
                  accessibilityRole="link"
                  accessibilityHint="Opens the page"
                  style={{
                    paddingVertical: space.xs,
                    marginTop: space.xs,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: space.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Prose weight="medium">{p.entity_name ?? p.slug}</Prose>
                    <Mono size="micro" tone="secondary" style={{ marginTop: 2 }}>
                      {relativeTime(p.updated_at)}
                    </Mono>
                  </View>
                  <BandChip score={p.trust_score} />
                </Pressable>
              ))}
              {changes.updatedPages.length > pages.length ? (
                <Line>and {changes.updatedPages.length - pages.length} more</Line>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {yours.length > 0 ? (
        <>
          <Divider style={{ marginVertical: space.sm }} />
          <Mono size="micro" label tone="muted">
            {yours.length === 1 ? "a page you read moved" : `${yours.length} pages you read moved`}
          </Mono>
          {yours.map((page) => (
            <Pressable
              key={page.slug}
              onPress={() => onOpen(page.slug)}
              accessibilityRole="link"
              accessibilityHint="Opens the page; changes are marked in its audit trail"
              style={{ paddingVertical: space.xs, marginTop: space.xs }}
            >
              <Prose weight="medium">{page.entity_name}</Prose>
              <Mono size="micro" tone="secondary" style={{ marginTop: 2 }}>
                {page.score ? `score ${scoreMoveText(page.score)} · ` : ""}
                {plural(page.decisions, "decision")} · {relativeTime(page.latestAt)} · see why →
              </Mono>
            </Pressable>
          ))}
        </>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loop 3 — one page
// ---------------------------------------------------------------------------

export function PageChangeBar({ changes }: { changes: PageChanges }) {
  const lines: string[] = [];
  if (changes.score) lines.push(`score ${scoreMoveText(changes.score)}`);
  if (changes.newEvidence > 0) lines.push(plural(changes.newEvidence, "accepted evidence", "accepted evidence items"));
  if (changes.newReviews > 0) lines.push(plural(changes.newReviews, "fact-check verdict"));
  if (changes.otherDecisions > 0) lines.push(plural(changes.otherDecisions, "other decision"));
  if (changes.pageUpdated && lines.length === 0) lines.push("the page was rewritten");

  return (
    <Card style={{ marginBottom: space.lg, borderColor: color.textMuted }}>
      <Mono size="label" label tone="muted">
        Changed since you last read this · {relativeTime(changes.since)}
      </Mono>
      <Prose style={{ marginTop: space.sm }}>{lines.join(" · ")}</Prose>
      {changes.newDecisionIds.length > 0 ? (
        <Mono size="micro" tone="muted" style={{ marginTop: space.sm }}>
          The reasons are in the audit trail below, marked NEW.
        </Mono>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loop 2 — the Watch tab
// ---------------------------------------------------------------------------

export function WhatMovedCard({
  since,
  moves,
  firstVisit,
  activity = "ok",
  empty = false,
  onOpen,
}: {
  since: string | null;
  moves: WatchMove[];
  /**
   * "unavailable": the decision feed failed, so only score moves were
   * compared. "partial": the feed window may not reach back to `since`.
   * Either way the card must not say "nothing changed" (spec §7).
   */
  activity?: "ok" | "unavailable" | "partial";
  /** No snapshot yet: say when comparisons will start, rather than nothing. */
  firstVisit: boolean;
  /** Nothing followed at all; otherwise the card is about what you follow. */
  empty?: boolean;
  onOpen: (slug: string) => void;
}) {
  if (firstVisit) {
    return (
      <Card style={{ marginBottom: space.lg }}>
        <Mono size="label" label tone="muted">
          What moved
        </Mono>
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          {empty ? "Changes to what you follow will show here." : "Nothing has changed since you last looked."}
        </Prose>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: space.lg, borderColor: moves.length > 0 ? color.textMuted : color.borderDefault }}>
      <Mono size="label" label tone="muted">
        What moved{since ? ` since ${relativeTime(since)}` : ""}
      </Mono>
      {moves.length === 0 ? (
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          {activity === "ok"
            ? "Nothing you follow has changed."
            : activity === "partial"
              ? "No score changes. Recent decisions may be missing; open a page for its full trail."
              : "No score changes. Decisions didn't load; pull down to retry."}
        </Prose>
      ) : (
        moves.map((move, index) => (
          <View key={move.slug}>
            {index > 0 ? <Divider style={{ marginVertical: space.sm }} /> : null}
            <Pressable
              onPress={() => onOpen(move.slug)}
              accessibilityRole="link"
              accessibilityHint="Opens the page; the reason is in its audit trail"
              style={{ paddingVertical: space.xs, marginTop: index === 0 ? space.sm : 0 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
                <Prose weight="medium" style={{ flex: 1 }}>
                  {move.entity_name}
                </Prose>
                {move.score ? <BandChip score={move.score.to} /> : null}
              </View>
              {move.score ? <Line>score {scoreMoveText(move.score)}</Line> : null}
              {move.events.slice(0, 3).map((event) => (
                <Line key={event.id}>
                  {decisionLabel(event.decision)} · {relativeTime(event.created_at)}
                </Line>
              ))}
              {move.events.length > 3 ? <Line>+{move.events.length - 3} more</Line> : null}
            </Pressable>
          </View>
        ))
      )}
      {moves.length > 0 && activity !== "ok" ? (
        <Mono size="micro" tone="muted" style={{ marginTop: space.sm }}>
          {activity === "partial"
            ? "Older decisions may be missing."
            : "Decisions didn't load; scores only."}
        </Mono>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loop 6 — the Scan tab
// ---------------------------------------------------------------------------

export function ScanDiffCard({ diff, onOpen }: { diff: ScanDiff; onOpen: (slug: string) => void }) {
  const empty = scanDiffIsEmpty(diff);

  const name = (h: { symbol: string | null; mint: string }) => h.symbol ?? `${h.mint.slice(0, 6)}…`;

  return (
    <Card style={{ borderColor: empty ? color.borderDefault : color.textMuted }}>
      <Mono size="label" label tone="muted">
        Since your last scan · {relativeTime(diff.since)}
      </Mono>
      {empty ? (
        <Prose tone="secondary" style={{ marginTop: space.sm }}>
          No change: same positions, same scores.
        </Prose>
      ) : null}
      {diff.risk ? <Line>wallet trust {diff.risk.from} → {diff.risk.to}</Line> : null}
      {diff.scoreChanges.map((h) => (
        <Pressable key={`s-${h.mint}`} onPress={() => h.slug && onOpen(h.slug)} accessibilityRole="link">
          <Line>
            {name(h)}: score {scoreMoveText({ from: h.from, to: h.to })} · see why →
          </Line>
        </Pressable>
      ))}
      {diff.newlyCovered.map((h) => (
        <Pressable key={`c-${h.mint}`} onPress={() => h.slug && onOpen(h.slug)} accessibilityRole="link">
          <Line>{name(h)}: now has a page · open →</Line>
        </Pressable>
      ))}
      {diff.added.length > 0 ? (
        <Line>
          {plural(diff.added.length, "new token")}: {diff.added.slice(0, 4).map(name).join(", ")}
          {diff.added.length > 4 ? "…" : ""}
        </Line>
      ) : null}
      {diff.positionsCapped ? (
        <Line>This wallet has more tokens than a scan covers, so new and sold tokens are not compared.</Line>
      ) : null}
      {diff.removed.length > 0 ? (
        <Line>
          {plural(diff.removed.length, "token")} no longer held: {diff.removed.slice(0, 4).map(name).join(", ")}
          {diff.removed.length > 4 ? "…" : ""}
        </Line>
      ) : null}
    </Card>
  );
}

