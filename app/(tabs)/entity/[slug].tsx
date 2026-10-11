/**
 * Entity page (J1) — the whole case file on a phone.
 *
 * Trust ring gauge with the provisional caveat when `severity_base` is null
 * (D8), lifecycle status pill (DESIGN.md axis B, orthogonal to the band),
 * summary, sections with the severity edge bar (axis C), timeline, sources,
 * and the on-chain audit trail.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Share, View, type ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WhileFocused, goBack } from "@/src/navigation/hidden-route";
import {
  Button,
  Card,
  Divider,
  Mono,
  Prose,
  Screen,
  StatusPill,
  TrustGauge,
  border,
  color,
  isSeverity,
  bandForPageScore,
  radius,
  space,
  QueueLink,
} from "@/src/design";
import { getInvestigation } from "@/src/api/investigations";
import { getAuditPage, type AuditTrail, type DecisionRow } from "@/src/api/audit";
import {
  anchorDetailLine,
  actionBlockState,
  anchoredLabel,
  arrangeActions,
  auditSummaryLine,
  buildContents,
  contentsHeading,
  countUniqueSources,
  decisionHeading,
  factCheckButtonLabel,
  deltaTone,
  formatDelta,
  isoDate,
  needsClamp,
  shortHash,
} from "@/src/page/format";
import { ActionButton } from "@/src/page/ActionButton";
import { buildSharePayload } from "@/src/page/share";
import { ChainIcon } from "@/src/page/ChainIcon";
import { sourceArchiveUrl, type InvestigationDetail } from "@/src/api/types";
import { ApiError } from "@/src/api/client";
import { explorerTxUrl } from "@/src/solana/cluster";
import { verifyAnchor, type AnchorVerification } from "@/src/solana/verify-anchor";
import { webUrl } from "@/src/api/config";
import { SignInLink, useSession } from "@/src/session";
import { pageChanges, type PageChanges, type PageSnapshot } from "@/src/retention/diff";
import { readPage, rememberPage } from "@/src/retention/memory";
import { NewMarker, PageChangeBar } from "@/src/retention/components";
import { relativeTime } from "@/src/retention/time";
import { requestPageUpdate } from "@/src/api/requests";
import { factCheckText, requestFactCheck, type FactCheckRequestState } from "@/src/api/review-requests";
import {
  updateRequestDone,
  updateRequestText,
  type UpdateRequestState,
} from "@/src/api/update-request-state";
import {
  findFollowedPage,
  followTarget,
  unfollowItem,
  useWatchlist,
} from "@/src/retention/watchlist-store";

function EntityScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { signedIn, signedOut } = useSession();

  const [page, setPage] = useState<(InvestigationDetail & { follower_count?: number | null }) | null>(null);
  const [audit, setAudit] = useState<AuditTrail | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followSaving, setFollowSaving] = useState(false);
  const [followMessage, setFollowMessage] = useState<string | null>(null);
  /** "Update this page": null until pressed; the server dedupes a repeat press. */
  const [updateState, setUpdateState] = useState<UpdateRequestState | null>(null);
  const [updateSaving, setUpdateSaving] = useState(false);
  /** "Request fact-check": sent on press only, never on load. */
  const [factCheck, setFactCheck] = useState<FactCheckRequestState | null>(null);
  const [factCheckSaving, setFactCheckSaving] = useState(false);
  /** Sources are a long list; collapsed until asked for. */
  const [sourcesOpen, setSourcesOpen] = useState(false);
  /**
   * Contents list -> scroll. Positions come from onLayout (relative to their
   * wrapper; the wrappers sit directly in the scroll content), so a tap
   * scrolls to wrapper-y + card-y.
   */
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const jumpTo = useCallback((key: string) => {
    const y = offsets.current[key];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - space.md), animated: true });
  }, []);
  /**
   * The shared watchlist (one GET per app session, not per page opened), so
   * the button can say "Following" truthfully on a page followed yesterday.
   */
  const watchlist = useWatchlist(signedIn);
  const followed = slug ? findFollowedPage(watchlist.items, slug) : null;

  /**
   * Loop 3 — "since you last read this". `previous` is what this phone stored
   * the last time the page was opened: undefined while it is being read, null
   * on a first visit. The comparison runs once, when the page and its audit
   * trail have both settled, and only then is the new snapshot written — so
   * the bar describes the visit before this one, and stays on screen for this
   * whole visit.
   */
  const [previous, setPrevious] = useState<PageSnapshot | null | undefined>(undefined);
  const [changes, setChanges] = useState<PageChanges | null>(null);
  const remembered = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setPage(null);
    setError(null);
    getInvestigation(slug)
      .then((data) => active && setPage(data))
      .catch((err) => active && setError(err instanceof ApiError && err.status === 404 ? "Page not found." : "Couldn't load. Try again."));

    // GET /api/v1/investigations/:slug/audit — newest decision first, CDN
    // cached for five minutes. A failure degrades this one panel rather than
    // the page.
    setAudit(null);
    setAuditError(null);
    setPrevious(undefined);
    setChanges(null);
    remembered.current = false;
    void readPage(slug).then((snapshot) => active && setPrevious(snapshot));
    getAuditPage(slug, { limit: 20 })
      .then((trail) => active && setAudit(trail))
      .catch(() => active && setAuditError("failed"));

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!page || previous === undefined || remembered.current) return;
    if (audit === null && auditError === null) return; // audit still loading
    remembered.current = true;
    setChanges(
      pageChanges(previous, { score: page.trust_score, updated_at: page.updated_at }, audit?.events ?? []),
    );
    void rememberPage(
      {
        slug: page.slug,
        entity_name: page.entity_name,
        score: page.trust_score,
        updated_at: page.updated_at,
      },
      audit?.events[0]?.created_at ?? null,
    );
  }, [page, previous, audit, auditError]);

  /** One toggle: Follow ↔ Following. The store keeps every screen in step. */
  const onToggleFollow = useCallback(async () => {
    if (!slug) return;
    if (!signedIn) {
      router.push("/profile");
      return;
    }
    setFollowSaving(true);
    setFollowMessage(null);
    try {
      if (followed) await unfollowItem(followed.id);
      else await followTarget({ target_kind: "investigation", slug });
    } catch (err) {
      setFollowMessage(followErrorText(err));
    } finally {
      setFollowSaving(false);
    }
  }, [slug, signedIn, followed, router]);

  /** Signed-in only. POSTs on press, never on load. */
  const onRequestUpdate = useCallback(async () => {
    if (!slug || updateSaving || updateRequestDone(updateState)) return;
    if (!signedIn) {
      router.push("/profile");
      return;
    }
    setUpdateSaving(true);
    try {
      setUpdateState(await requestPageUpdate(slug, page?.entity_name));
    } finally {
      setUpdateSaving(false);
    }
  }, [slug, signedIn, updateSaving, updateState, router, page?.entity_name]);

  const onRequestFactCheck = useCallback(async () => {
    if (!slug || factCheckSaving || factCheck?.kind === "requested" || factCheck?.kind === "already") return;
    setFactCheckSaving(true);
    try {
      setFactCheck(await requestFactCheck(slug));
    } finally {
      setFactCheckSaving(false);
    }
  }, [slug, factCheckSaving, factCheck]);

  if (error) {
    return (
      <Screen title="not found">
        <Card>
          <Prose tone="secondary">{error}</Prose>
        </Card>
        <View style={{ height: space.lg }} />
        <Button label="Back" onPress={() => goBack(router)} />
      </Screen>
    );
  }

  if (!page) {
    return (
      <Screen title={slug ?? ""}>
        <ActivityIndicator color={color.textMuted} />
      </Screen>
    );
  }

  const isConcept = page.content_type === "concept";
  // D8 / SCORING_V2_RFC §4.1: a NULL severity_base means the number was never
  // produced by the deterministic scorer. Concept pages carry no verdict at all.
  const provisional = !isConcept && page.severity_base === null;
  const score = page.trust_score;
  const factCheckDone = factCheck?.kind === "requested" || factCheck?.kind === "already";
  // Follow and Submit always; Update and Fact-check only on non-concept pages.
  // The dates live inside the buttons (sublabels); recently updated or
  // fact-checked pages promote Submit evidence to a full-width top button.
  const cooldown = factCheck?.kind === "cooldown" ? factCheck : null;
  const block = actionBlockState({
    now: Date.now(),
    contentUpdatedAt: page.content_updated_at,
    updatedAt: page.updated_at,
    updateNextAllowedAt: page.update_next_allowed_at,
    lastFactCheckedAt: page.last_fact_checked_at,
    factCheckNextAllowedAt: page.fact_check_next_allowed_at,
    reviewed: page.reviewed,
    cooldownReply: !!cooldown,
    cooldownNextAllowedAt: cooldown?.nextAllowedAt,
  });
  const promote = !isConcept && block.promoteSubmit;
  const actions: Array<{ key: string; label: string; sublabel?: string; onPress: () => void; disabled?: boolean; highlight?: boolean; accessibilityHint?: string }> = [
    {
      key: "follow",
      label: followSaving
        ? followed
          ? "Unfollowing…"
          : "Following…"
        : followed
          ? "✓ Following"
          : "Follow",
      sublabel:
        !followSaving && followed
          ? followed.created_at ? `followed ${relativeTime(followed.created_at)}` : undefined
          : undefined,
      onPress: () => void onToggleFollow(),
      disabled: followSaving || (signedIn && watchlist.items === null && watchlist.loading),
      accessibilityHint: followed ? "Stops alerts for this page" : undefined,
    },
    {
      key: "submit",
      label: "Submit evidence",
      sublabel: promote ? (block.submitSublabel ?? undefined) : undefined,
      highlight: promote,
      onPress: () => (signedIn ? router.push(`/entity/${page.slug}/submit`) : router.push("/profile")),
    },
  ];
  if (!isConcept) {
    const updateDone = updateRequestDone(updateState);
    actions.push({
      key: "update",
      label: updateSaving
        ? "Requesting…"
        : updateDone
          ? updateRequestText(updateState)
          : block.update.label,
      sublabel: updateSaving || updateDone ? undefined : block.update.sublabel,
      onPress: () => void onRequestUpdate(),
      disabled: updateSaving || updateDone || block.update.disabled,
      accessibilityHint:
        "Asks for this page to be re-researched from fresh sources. Counts toward your daily request limit.",
    });
    // Needs no account. Shown on unchecked pages, and greyed on a page
    // fact-checked in the last 7 days.
    if (block.factCheck) {
      const cooling = block.recentlyFactChecked;
      actions.push({
        key: "factcheck",
        label: cooling ? block.factCheck.label : factCheckButtonLabel(factCheck?.kind, factCheckSaving),
        sublabel: cooling ? block.factCheck.sublabel : undefined,
        onPress: () => void onRequestFactCheck(),
        disabled: cooling || factCheckSaving || factCheckDone,
        accessibilityHint: "Asks for this page to be fact-checked. Pages people ask about are reviewed first.",
      });
    }
  }
  const contents = buildContents({
    sectionHeadings: (page.sections ?? []).map((section) => section.heading),
    timelineCount: (page.timeline ?? []).length,
  });

  const sharePage = () => {
    const payload = buildSharePayload({
      name: page.entity_name,
      score: isConcept ? null : score,
      bandLabel: !isConcept && score !== null ? bandForPageScore(score).label : null,
      reviewed: !!page.reviewed,
      url: webUrl(page.slug),
    });
    // Android ignores `url`; the link is also the last line of `message`.
    void Share.share(payload, { dialogTitle: payload.title }).catch(() => {});
  };

  return (
    <Screen title={`avoid.net/${page.slug}`} scrollRef={scrollRef}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg }}>
        <Pressable onPress={() => goBack(router)} hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
          <Mono size="label" label tone="muted">
            ← back
          </Mono>
        </Pressable>
        <Pressable
          onPress={sharePage}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share this page"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Mono size="label" tone="secondary">
            [↗ SHARE]
          </Mono>
        </Pressable>
      </View>

      <View style={{ alignItems: "center", gap: space.md, marginBottom: changes ? space.lg : space.xl }}>
        {!isConcept && score !== null ? (
          <TrustGauge score={score} confidence={page.confidence} provisional={provisional} />
        ) : null}
        <Prose size="heading" weight="semibold" style={{ textAlign: "center" }}>
          {page.entity_name}
        </Prose>
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap", justifyContent: "center" }}>
          <StatusPill label={lifecycleLabel(page)} tone={page.reviewed ? "verified" : "neutral"} />
          {page.content_type ? <StatusPill label={page.content_type} tone="neutral" /> : null}
        </View>
      </View>

      {changes ? <PageChangeBar changes={changes} /> : null}

      {/* Everything you can do to this page, together, before the summary. */}
      <View style={{ gap: space.sm, marginBottom: space.lg }}>
        {/* Promoted Submit evidence on top; otherwise two per row, an odd last button spans the row. */}
        {arrangeActions(actions.map((a) => a.key), promote).map((row, i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.sm }}>
            {row.map((key) => {
              const action = actions.find((a) => a.key === key)!;
              return (
                <ActionButton key={action.key} label={action.label} sublabel={action.sublabel} onPress={action.onPress} disabled={action.disabled} highlight={action.highlight} accessibilityHint={action.accessibilityHint} />
              );
            })}
          </View>
        ))}

        {followMessage ? (
          <Prose size="body" tone="muted">
            {followMessage}
          </Prose>
        ) : signedIn ? (
          <Mono size="micro" tone="muted">
            Get alerts when the score changes.
          </Mono>
        ) : null}
        {updateState && !updateRequestDone(updateState) ? (
          <Mono size="micro" tone="muted">
            {updateRequestText(updateState)}
          </Mono>
        ) : null}
        {updateState && (updateState.kind === "queued" || updateState.kind === "already") ? (
          <QueueLink
            label="Track progress →"
            onPress={() =>
              updateState.requestId
                ? router.push(`/request/${updateState.requestId}`)
                : void Linking.openURL(webUrl("queue"))
            }
          />
        ) : null}
        {/* Success is in the button; only a failure needs a line. Fact-check
            requests live in review_requests, so there is no queue link. */}
        {!isConcept && factCheck && !factCheckDone && factCheck.kind !== "cooldown" ? (
          <Mono size="micro" tone="muted">
            {factCheckText(factCheck)}
          </Mono>
        ) : null}
        {signedOut ? (
          <Prose size="body" tone="muted">
            Following, submitting and update requests need an account. <SignInLink />.
          </Prose>
        ) : null}
      </View>

      {page.summary ? (
        <Card style={{ marginBottom: space.lg }}>
          <Prose>{page.summary}</Prose>
        </Card>
      ) : null}

      {/* Contents — a tap scrolls to the section. */}
      {contents.length > 0 ? (
        <View style={{ marginBottom: space.lg }}>
          <Mono size="label" label tone="secondary" style={{ marginBottom: space.sm }}>
            {contentsHeading(countUniqueSources(page.sources_used, page.sections), (page.timeline ?? []).length)}
          </Mono>
          {contents.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={() => jumpTo(item.key)}
              accessibilityRole="button"
              accessibilityHint="Scrolls to this part of the page"
              style={{ paddingVertical: space.xs }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View style={{ width: 26, paddingTop: 5 }}>
                  <Mono size="micro" tone="muted">
                    {String(i + 1).padStart(2, "0")}
                  </Mono>
                </View>
                <Prose size="body" tone="secondary" style={{ flex: 1 }}>
                  {item.label}
                </Prose>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Sections — severity carried by the left edge bar, never a pill. */}
      {(page.sections ?? []).length > 0 ? (
        <View
          style={{ gap: space.md, marginBottom: space.lg }}
          onLayout={(e) => {
            offsets.current.sectionsBase = e.nativeEvent.layout.y;
          }}
        >
          <Mono size="label" label tone="secondary">
            Sections
          </Mono>
          {(page.sections ?? []).map((section, i) => (
            <Card
              key={`${section.heading}-${i}`}
              onLayout={(e) => {
                offsets.current[`section-${i}`] = (offsets.current.sectionsBase ?? 0) + e.nativeEvent.layout.y;
              }}
              severity={!isConcept && isSeverity(section.severity) ? section.severity : undefined}
            >
              <Prose weight="semibold" style={{ marginBottom: space.sm }}>
                {section.heading}
              </Prose>
              <Prose tone="secondary">{section.content}</Prose>
              {(section.sources ?? []).length > 0 ? (
                <>
                  <Divider />
                  <SectionSources sources={section.sources ?? []} />
                </>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {/* Timeline */}
      {(page.timeline ?? []).length > 0 ? (
        <View
          style={{ marginBottom: space.lg }}
          onLayout={(e) => {
            offsets.current.timeline = e.nativeEvent.layout.y;
          }}
        >
          <Mono size="label" label tone="secondary" style={{ marginBottom: space.md }}>
            Timeline
          </Mono>
          <Card>
            {(page.timeline ?? []).map((event, i) => (
              <View key={`${event.date}-${i}`} style={{ marginBottom: space.md }}>
                <Mono size="micro" tone="muted" label>
                  {event.date}
                </Mono>
                <Prose tone="secondary" style={{ marginTop: 2 }}>
                  {event.event}
                </Prose>
                {event.source_url ? <SourceLine name={event.source ?? "source"} url={event.source_url} /> : null}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {/* Sources */}
      {(page.sources_used ?? []).length > 0 ? (
        <View style={{ marginBottom: space.lg }}>
          <Pressable
            onPress={() => setSourcesOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: sourcesOpen }}
            accessibilityLabel={`Sources, ${(page.sources_used ?? []).length}`}
            accessibilityHint={sourcesOpen ? "Hides the list" : "Shows the list"}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: space.xs,
            }}
          >
            <Mono size="label" label tone="secondary">
              Sources ({(page.sources_used ?? []).length})
            </Mono>
            <Mono size="label" tone="secondary">
              {sourcesOpen ? "[−]" : "[+]"}
            </Mono>
          </Pressable>
          {sourcesOpen ? (
            <Card style={{ marginTop: space.sm }}>
              <SourceList sources={page.sources_used ?? []} />
            </Card>
          ) : null}
        </View>
      ) : null}

      {/* Audit trail — GET /api/v1/investigations/:slug/audit */}
      <View style={{ marginBottom: space.lg }}>
        <Mono size="label" label tone="secondary" style={{ marginBottom: space.md }}>
          Audit trail{audit ? ` (${audit.total})` : ""}
        </Mono>
        {audit && audit.events.length > 0 ? (
          <Mono size="micro" tone="muted" style={{ marginBottom: space.sm }}>
            {auditSummaryLine(audit.events, audit.total)}
          </Mono>
        ) : null}
        <Card>
          {audit === null && auditError === null ? (
            <ActivityIndicator color={color.textMuted} />
          ) : null}
          {auditError ? (
            <Prose tone="muted">Couldn&apos;t load the audit trail.</Prose>
          ) : null}
          {audit !== null && audit.events.length === 0 ? (
            <Prose tone="muted">No decisions yet.</Prose>
          ) : null}
          {(audit?.events ?? []).map((row, i) => (
            <View key={row.id}>
              {i > 0 ? <Divider /> : null}
              <DecisionRowView row={row} isNew={changes?.newDecisionIds.includes(row.id) ?? false} />
            </View>
          ))}
        </Card>
      </View>

      <Button label="Open on avoid.net" onPress={() => void Linking.openURL(webUrl(page.slug))} />
      <Pressable
        onPress={sharePage}
        accessibilityRole="button"
        accessibilityLabel="Share this page"
        style={{ minHeight: 44, justifyContent: "center", alignItems: "center", marginTop: space.md }}
      >
        <Mono size="label" tone="secondary">
          Share this page ↗
        </Mono>
      </Pressable>
    </Screen>
  );
}

/** The Follow failures a person can act on, in their words. */
function followErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      const limit = (err.body as { limit?: number } | null)?.limit;
      return `You are following the most pages your account allows${
        typeof limit === "number" ? ` (${limit})` : ""
      }. Unfollow one on the Watch tab. SKR holders get a larger limit.`;
    }
    if (err.status === 403) return "Pick a handle on the Profile tab first, then follow.";
    if (err.status === 0) return "Offline. Try again when you have a connection.";
  }
  return "Couldn't update. Try again.";
}

/**
 * DESIGN.md axis B — page lifecycle, not severity. Worded to match the web
 * after the owner's decision on #187: neither axis says "verified" any more
 * (the top score band is LOW RISK; a reviewed page is FACT-CHECKED).
 */
function lifecycleLabel(page: InvestigationDetail): string {
  if (page.reviewed) return "✓ fact-checked";
  if (page.status === "under_investigation") return "in review";
  if (page.status === "published") return "AI-drafted, unchecked";
  return page.status;
}

/**
 * One decision, with the on-chain check the phone can run itself (J6).
 *
 * The explorer link follows `anchor_cluster` ON THE ROW, not the app's
 * selected cluster: the server's anchor worker has historically written to
 * devnet while the app defaults to mainnet-beta, so following the app's
 * setting would send the user to a transaction that does not exist there.
 * `verifyAnchor` uses the same rule, and compares the memo's hash with the
 * `content_hash` this row claims — with no AVOID.NET server in the loop.
 */
function DecisionRowView({ row, isNew }: { row: DecisionRow; isNew: boolean }) {
  const [check, setCheck] = useState<AnchorVerification | null>(null);
  const [verifying, setVerifying] = useState(false);

  const onVerify = useCallback(async () => {
    if (!row.anchor_signature) return;
    setVerifying(true);
    try {
      setCheck(
        await verifyAnchor(row.anchor_signature, {
          cluster: clusterOfRow(row.anchor_cluster),
          expectedHash: row.content_hash ?? undefined,
        }),
      );
    } finally {
      setVerifying(false);
    }
  }, [row.anchor_signature, row.anchor_cluster, row.content_hash]);

  const [open, setOpen] = useState(false);
  const delta = formatDelta(row.score_delta);
  const hash = shortHash(row.content_hash);
  const cluster = clusterOfRow(row.anchor_cluster);
  const anchorDetail = anchorDetailLine(row.anchor_signature ? row.anchor_slot : null, hash);

  return (
    <View style={{ marginBottom: space.sm }}>
      {/* #3 REVIEW REVISE -7 — the website's decision-log heading. */}
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", flexWrap: "wrap" }}>
        {isNew ? <NewMarker /> : null}
        <Mono size="label" weight="medium" label>
          {decisionHeading(row.sequence_num, row.decision)}
        </Mono>
        {delta !== null ? (
          <Mono size="label" weight="semibold" color={DELTA_COLOR[deltaTone(row.score_delta)]}>
            {delta}
          </Mono>
        ) : null}
      </View>

      {row.anchor_signature ? (
        <View style={{ flexDirection: "row", gap: space.md, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
          <Pressable
            onPress={() =>
              void Linking.openURL(explorerTxUrl(row.anchor_signature as string, row.anchor_cluster))
            }
            accessibilityRole="link"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <ChainIcon color={color.accentAnchor} />
              <Mono size="micro" color={color.accentAnchor}>
                {anchoredLabel()}{cluster === "mainnet-beta" ? "" : ` · ${cluster}`}
              </Mono>
            </View>
          </Pressable>
          {/* An outlined pill so it reads as a button; hitSlop lifts the touch target to ~44dp. */}
          <Pressable
            onPress={() => void onVerify()}
            disabled={verifying}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityState={{ disabled: verifying }}
            style={{
              minHeight: 28,
              justifyContent: "center",
              borderWidth: border.width,
              borderColor: verifying ? color.borderMuted : color.borderDefault,
              borderRadius: radius.card,
              paddingHorizontal: space.md,
            }}
          >
            <Mono size="micro" tone={verifying ? "muted" : "secondary"} label>
              {verifying ? "verifying…" : "verify"}
            </Mono>
          </Pressable>
        </View>
      ) : (
        <Mono size="micro" tone="muted" style={{ marginTop: 6 }}>
          {row.anchor_status ?? "not recorded yet"}
        </Mono>
      )}

      {check ? (
        <Mono
          size="micro"
          tone={check.matches === true ? "secondary" : "muted"}
          style={{ marginTop: 4 }}
        >
          {verdictText(check)}
        </Mono>
      ) : null}

      <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
        {[...[row.actor_label, row.decided_by].filter(Boolean), isoDate(row.created_at)].join(" · ")}
      </Mono>
      {anchorDetail ? (
        <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
          {anchorDetail}
        </Mono>
      ) : null}

      {row.reason ? (
        <>
          {/* Review summaries run to a paragraph; three lines, then "more". */}
          <Prose tone="secondary" size="body" style={{ marginTop: 6 }} numberOfLines={open ? undefined : 3}>
            {row.reason}
          </Prose>
          {needsClamp(row.reason) ? (
            <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} accessibilityRole="button">
              <Mono size="micro" tone="secondary" label style={{ marginTop: 2 }}>
                {open ? "less" : "more"}
              </Mono>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Score-change colours on the audit rows: red for a drop, green for a rise. */
const DELTA_COLOR = {
  critical: color.accentCritical,
  verified: color.accentVerified,
  muted: color.textMuted,
} as const;

function verdictText(check: AnchorVerification): string {
  if (check.error) return "Couldn't check. Try again.";
  if (check.matches === true) return "Matches the on-chain record.";
  if (check.matches === false) return "Does not match the on-chain record.";
  if (check.memo === null) return "No record found.";
  return "Cannot compare.";
}

/** The app speaks three clusters; a row can hold anything, so it is narrowed. */
function clusterOfRow(value: string | null): "mainnet-beta" | "devnet" | "testnet" {
  return value === "mainnet-beta" || value === "testnet" ? value : "devnet";
}

function SourceLine({ name, url }: { name: string; url: string }) {
  if (!url) {
    return (
      <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
        {name}
      </Mono>
    );
  }
  return (
    <Pressable onPress={() => void Linking.openURL(url)}>
      <Mono size="micro" tone="secondary" style={{ marginTop: 4 }}>
        ↗ {name || url}
      </Mono>
    </Pressable>
  );
}

/** A list of sources, each with its "archived copy" link when it has one. */
function SourceList({ sources }: { sources: NonNullable<InvestigationDetail["sources_used"]> }) {
  return (
    <>
      {sources.map((source, i) => {
        const archive = sourceArchiveUrl(source);
        return (
          <View key={`${source.url}-${i}`} style={{ marginBottom: space.sm }}>
            <SourceLine name={source.name} url={source.url} />
            {archive ? <SourceLine name="archived copy" url={archive} /> : null}
          </View>
        );
      })}
    </>
  );
}

/** A section's own sources: collapsed behind the same "Sources (N) [+]" toggle as the page-level block. */
function SectionSources({ sources }: { sources: NonNullable<InvestigationDetail["sources_used"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Sources, ${sources.length}`}
        accessibilityHint={open ? "Hides the list" : "Shows the list"}
        hitSlop={8}
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: space.xs }}
      >
        <Mono size="micro" label tone="secondary">
          Sources ({sources.length})
        </Mono>
        <Mono size="micro" tone="secondary">
          {open ? "[−]" : "[+]"}
        </Mono>
      </Pressable>
      {open ? <SourceList sources={sources} /> : null}
    </View>
  );
}

export default function EntityRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <WhileFocused id={slug}>
      <EntityScreen />
    </WhileFocused>
  );
}
