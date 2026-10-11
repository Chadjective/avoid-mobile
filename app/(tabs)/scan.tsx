/**
 * Wallet scan (J2) — the most mobile-shaped feature we have.
 *
 * Address comes from the connected wallet (no typing) or from a paste. The
 * scan itself is POST /api/scan then GET /api/scan/:id until it settles, with
 * a bounded, backing-off poll (max 20 tries) — web/CLAUDE.md: pollers must be
 * bounded and every request is a billed invocation.
 *
 * RE-SCAN (Loop 6, docs/RETENTION_LOOPS_SPEC.md §9a). The scan is the one
 * moment the app is about the user's own money, so it no longer ends when the
 * screen closes: this phone keeps the last scan of each wallet (holdings,
 * scores, exposure — src/retention/memory.ts, on-device only), offers "scan
 * again" for them, and after a re-scan leads with what changed since the last
 * one. (The "Watch this wallet" button was removed from the UI: Wallet Guardian
 * is out of scope this round. The backend and the watchlist route are kept.)
 * None of this adds a request: the diff is computed from the scan the user
 * asked for.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BandChip,
  Button,
  WalletButton,
  Card,
  Field,
  Mono,
  Prose,
  Screen,
  StatusPill,
  color,
  space,
  QueueLink,
} from "@/src/design";
import { webUrl } from "@/src/api/config";
import { pollScan, startScan } from "@/src/api/scan";
import type { HoldingRow, ScanReport } from "@/src/api/types";
import { ApiError } from "@/src/api/client";
import { createRequest } from "@/src/api/requests";
import { holdingRequest } from "@/src/search/request-offer";
import { canRequestHolding, holdingTagLine } from "@/src/scan/tags";
import { SignInLink, useSession } from "@/src/session";
import { scanDiff, type ScanDiff } from "@/src/retention/diff";
import { forgetScan, listScannedWallets, readScan, rememberScan, type StoredScan } from "@/src/retention/memory";
import { mergeScanLists, type ScanAgainEntry } from "@/src/retention/scan-merge";
import { getScanHistory } from "@/src/retention/scan-history";
import { ScanDiffCard } from "@/src/retention/components";
import { relativeTime } from "@/src/retention/time";

/** Wallets offered under "scan again". */
const RECENT_WALLETS = 3;

export default function ScanScreen() {
  const router = useRouter();
  const { wallet, me, connectWallet, connecting, signedIn, signedOut } = useSession();
  // Signing in with a wallet proves the address but does not leave an on-phone
  // wallet connection behind, so a signed-in account's proven wallet counts too.
  const accountWallet = me?.account?.wallet_verified_at ? (me.account.wallet_pubkey ?? null) : null;
  const walletAddress = wallet?.address ?? accountWallet;

  const [address, setAddress] = useState("");
  // Profile's "your wallet scans" opens this tab with an address. It is only
  // filled in, never scanned: a scan is a billed request and the person taps.
  const { address: addressParam } = useLocalSearchParams<{ address?: string }>();
  useEffect(() => {
    if (typeof addressParam === "string" && addressParam.length > 0) setAddress(addressParam);
  }, [addressParam]);
  const [status, setStatus] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The daily cap, which only a signed-out caller can raise by signing in. */
  const [limitNeedsSignIn, setLimitNeedsSignIn] = useState(false);
  const [running, setRunning] = useState(false);
  const [diff, setDiff] = useState<ScanDiff | null>(null);
  const [recentWallets, setRecentWallets] = useState<ScanAgainEntry[]>([]);

  /**
   * "Scan again" list = this phone's scans merged with the account's scans
   * from the server (one GET /api/scan per app session, cached), newest first
   * and de-duplicated by address, so a new phone still sees past wallets. The
   * holdings snapshot a diff needs stays on the phone: for a wallet known only
   * from the server, the first re-scan here shows no diff.
   */
  const refreshRecent = useCallback(async () => {
    const device = await listScannedWallets();
    const server = signedIn ? await getScanHistory().catch(() => []) : [];
    setRecentWallets(mergeScanLists(device, server).slice(0, RECENT_WALLETS));
  }, [signedIn]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const run = useCallback(
    async (target: string) => {
      const value = target.trim();
      if (value.length === 0) return;
      setRunning(true);
      setError(null);
      setLimitNeedsSignIn(false);
      setReport(null);
      setDiff(null);
      setStatus("starting");
      try {
        const created = await startScan(value);
        setStatus(created.status);
        if (created.status === "failed") {
          // The server answered: the scan itself failed (a data-provider outage),
          // so "try again" right now would not help.
          setError("Wallet scanning is temporarily unavailable. It doesn't count against your limit; try again later.");
          return;
        }
        const finished = await pollScan(created.id, {
          maxTries: 20,
          onUpdate: (r) => setStatus(r.scan.status),
        });
        setReport(finished);
        setStatus(finished.scan.status);
        // Compare with this phone's last scan of the same wallet, then keep
        // this one for next time. A failed scan is never stored: comparing
        // against it would report every holding as new.
        if (finished.scan.status === "complete" || finished.scan.status === "partial") {
          const current: StoredScan = {
            address: finished.scan.address,
            scannedAt: finished.scan.completed_at ?? finished.scan.created_at,
            risk_score: finished.scan.risk_score,
            holdings: finished.holdings.map((h) => ({
              mint: h.mint,
              symbol: h.symbol,
              slug: h.slug,
              trust_score: h.trust_score,
            })),
          };
          const previous = await readScan(current.address);
          // A duplicate scan (same result served again) is not a second look.
          setDiff(previous && previous.scannedAt !== current.scannedAt ? scanDiff(previous, current) : null);
          await rememberScan(current);
          await refreshRecent();
        }
      } catch (err) {
        if (err instanceof ApiError && err.isRateLimited) {
          if (signedIn) setError("Daily scan limit reached. It resets tomorrow.");
          else setLimitNeedsSignIn(true);
        } else if (err instanceof ApiError && err.code === "invalid_address") {
          setError("Enter a Solana wallet address (base58, 32 bytes).");
        } else if (err instanceof ApiError && err.code === "network") {
          setError("Couldn't reach avoid.net. Check your connection and try again.");
        } else {
          setError("Scan failed. Try again.");
        }
      } finally {
        setRunning(false);
      }
    },
    [signedIn, refreshRecent],
  );

  return (
    <Screen
      title="check before you sign"
      // Pinned above the tab bar, where the thumb is and where the wallet's own
      // Connect sheet opens. Gone once a wallet is known (the card above scans it).
      footer={
        walletAddress ? undefined : (
          <WalletButton
            label={connecting ? "Connecting…" : "Connect wallet"}
            onPress={() => void connectWallet()}
            disabled={connecting}
          />
        )
      }
    >
      <Card style={{ marginBottom: space.lg }}>
        <Mono size="label" label tone="muted">
          Wallet
        </Mono>
        {walletAddress ? (
          <>
            <Mono size="body" style={{ marginTop: space.sm }}>
              {shorten(walletAddress)}
            </Mono>
            <View style={{ height: space.md }} />
            <Button
              label="Scan this wallet"
              tier="primary"
              onPress={() => void run(walletAddress)}
              disabled={running}
            />
          </>
        ) : (
          <Prose tone="secondary" style={{ marginTop: space.sm }}>
            Connect a wallet to scan it, or paste an address below.
          </Prose>
        )}
      </Card>

      <Field
        value={address}
        onChangeText={setAddress}
        placeholder="Paste a Solana address"
        returnKeyType="go"
        onSubmitEditing={() => void run(address)}
      />
      <View style={{ height: space.md }} />
      <Button label="Scan" onPress={() => void run(address)} disabled={running} />

      {running ? (
        <View style={{ marginTop: space.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <ActivityIndicator color={color.textMuted} />
            <Mono size="micro" tone="muted" label>
              scanning
            </Mono>
          </View>
          {/* POST /api/scan answers only when the whole scan is done (up to
              a minute), so "starting" can sit still that long. Say so. */}
          <Prose tone="secondary" style={{ marginTop: space.sm }}>
            Checking each token. This can take up to a minute.
          </Prose>
        </View>
      ) : null}

      {limitNeedsSignIn && signedOut ? (
        <Card style={{ marginTop: space.lg }}>
          <Prose tone="secondary">
            Daily scan limit reached. <SignInLink /> for a higher one.
          </Prose>
        </Card>
      ) : error ? (
        <Card style={{ marginTop: space.lg }}>
          <Prose tone="secondary">{error}</Prose>
        </Card>
      ) : null}

      {recentWallets.filter((w) => w.address !== walletAddress).length > 0 ? (
        <Card style={{ marginBottom: space.lg }}>
          <Mono size="label" label tone="muted">
            Scan again
          </Mono>
          {recentWallets
            .filter((w) => w.address !== walletAddress)
            .map((w) => (
              <View
                key={w.address}
                style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm }}
              >
                <Pressable
                  style={{ flex: 1, paddingVertical: space.xs }}
                  onPress={() => void run(w.address)}
                  disabled={running}
                  accessibilityRole="button"
                  accessibilityHint="Scans this wallet again and shows what changed"
                >
                  <Mono size="body">{shorten(w.address)}</Mono>
                  <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
                    last scanned {relativeTime(w.scannedAt)}
                    {w.positions !== null ? ` · ${w.positions} tokens` : ""}
                  </Mono>
                </Pressable>
                <Pressable
                  onPress={() =>
                    void forgetScan(w.address).then(() =>
                      setRecentWallets((list) => list.filter((x) => x.address !== w.address)),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Forget ${shorten(w.address)} on this phone`}
                  hitSlop={8}
                >
                  <Mono size="micro" tone="muted" label>
                    forget
                  </Mono>
                </Pressable>
              </View>
            ))}
        </Card>
      ) : null}

      {report ? (
        <>
          {diff ? (
            <View style={{ marginTop: space.xl }}>
              <ScanDiffCard diff={diff} onOpen={(slug) => router.push(`/entity/${slug}`)} />
            </View>
          ) : null}
          <ScanResult report={report} onOpen={(slug) => router.push(`/entity/${slug}`)} />
        </>
      ) : null}
    </Screen>
  );
}

function ScanResult({ report, onOpen }: { report: ScanReport; onOpen: (slug: string) => void }) {
  const { scan, holdings } = report;
  return (
    <View style={{ marginTop: space.xl, gap: space.md }}>
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
        {scan.status === "complete" ? null : <StatusPill label="partial scan" tone="neutral" />}
        <Mono size="micro" tone="muted">
          {scan.position_count ?? 0} tokens · {scan.covered_count ?? 0} with a page ·{" "}
          {scan.unknown_count ?? 0} unknown
        </Mono>
      </View>

      {scan.risk_score !== null ? (
        <Card>
          <Mono size="label" label tone="muted">
            Wallet trust
          </Mono>
          <View style={{ marginTop: space.sm }}>
            <BandChip score={scan.risk_score} />
          </View>
        </Card>
      ) : null}

      {holdings.map((holding) => (
        <HoldingCard key={holding.id} holding={holding} onOpen={onOpen} />
      ))}

      {holdings.length === 0 ? (
        <Card>
          <Prose tone="secondary">No tokens found in this wallet.</Prose>
        </Card>
      ) : null}
    </View>
  );
}

function HoldingCard({
  holding,
  onOpen,
}: {
  holding: HoldingRow;
  onOpen: (slug: string) => void;
}) {
  const router = useRouter();
  const { signedIn } = useSession();
  const [requesting, setRequesting] = useState(false);
  const [requestNote, setRequestNote] = useState<string | null>(null);
  /** The note is a "received" message with no request id: offer the queue link. */
  const [noteQueued, setNoteQueued] = useState(false);

  /**
   * "Request investigation" — the same call as Search's "Request investigation", with
   * the token's name and mint as context. Signed out opens Profile, like the
   * other sign-in-gated actions.
   */
  const onRequestPage = useCallback(async () => {
    if (!signedIn) {
      router.push("/profile");
      return;
    }
    const { entity, context } = holdingRequest(holding);
    setRequesting(true);
    setRequestNote(null);
    setNoteQueued(false);
    try {
      const result = await createRequest(entity, context);
      if (result.request?.id) {
        router.push(`/request/${result.request.id}`);
        return;
      }
      if (result.slug) {
        router.push(`/entity/${result.slug}`);
        return;
      }
      setRequestNote(result.message ?? "Request received.");
      setNoteQueued(true);
    } catch (err) {
      if (err instanceof ApiError && err.isRateLimited) setRequestNote("Daily limit reached. Try again tomorrow.");
      else setRequestNote("Couldn't send the request. Try again.");
    } finally {
      setRequesting(false);
    }
  }, [holding, signedIn, router]);

  const tagLine = holdingTagLine(holding.flags);
  const canRequest = canRequestHolding(holding);

  const body = (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Prose weight="medium">{holding.symbol ?? holding.name ?? shorten(holding.mint)}</Prose>
          <Mono size="micro" tone="muted" style={{ marginTop: 2 }}>
            {shorten(holding.mint)}
            {holding.value_usd !== null ? ` · $${holding.value_usd.toFixed(2)}` : ""}
          </Mono>
          {tagLine ? (
            <Mono size="micro" tone="muted" style={{ marginTop: 4 }}>
              {tagLine}
            </Mono>
          ) : null}
        </View>
        {holding.slug ? (
          <BandChip score={holding.trust_score} />
        ) : canRequest ? (
          <Pressable
            onPress={() => void onRequestPage()}
            disabled={requesting}
            accessibilityRole="button"
            accessibilityLabel={`Request investigation of ${holding.symbol ?? holding.name ?? shorten(holding.mint)}`}
            hitSlop={8}
            style={{ alignSelf: "flex-start" }}
          >
            <Mono size="micro" color={color.accentAnchor}>
              {requesting ? "requesting…" : "Request →"}
            </Mono>
          </Pressable>
        ) : null}
      </View>
      {requestNote ? (
        <View style={{ marginTop: space.sm, alignItems: "flex-start" }}>
          <Mono size="micro" tone="muted">
            {requestNote}
          </Mono>
          {noteQueued ? <QueueLink url={webUrl("queue")} /> : null}
        </View>
      ) : null}
    </Card>
  );

  if (!holding.slug) return body;
  return (
    <Pressable onPress={() => onOpen(holding.slug as string)} accessibilityRole="link">
      {body}
    </Pressable>
  );
}

function shorten(value: string, keep = 6): string {
  if (value.length <= keep * 2 + 3) return value;
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
