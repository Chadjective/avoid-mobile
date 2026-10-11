/**
 * Alerts (J3). The in-app tab IS the outbox — GET /api/v1/feed reads the same
 * `notifications_outbox` rows the dispatcher pushes from, so what the phone
 * buzzed about and what the list shows can never disagree (spec §8).
 *
 * Rows newer than this tab's last visit carry a NEW marker; the marker lives
 * on the phone (src/retention/memory.ts), so reading alerts costs nothing
 * extra and the server keeps no read receipts. Pull to refresh; no polling —
 * push is what brings new rows (spec D4).
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { Card, Mono, Prose, Screen, color, space } from "@/src/design";
import { getFeed, type Alert } from "@/src/api/feed";
import { ApiError } from "@/src/api/client";
import {
  getRegisteredPushToken,
  hasRegisteredPushDevice,
  registerForPushNotifications,
  unregisterForPushNotifications,
} from "@/src/notifications";
import { SignInLink, useSession } from "@/src/session";
import { beginAlertsVisit } from "@/src/retention/memory";
import { NewMarker } from "@/src/retention/components";
import { relativeTime } from "@/src/retention/time";

/** The outbox kinds, in the words the alert list uses. */
const KIND_LABEL: Record<Alert["kind"], string> = {
  score_changed: "score changed",
  evidence_accepted: "evidence accepted",
  review_verdict: "fact-check",
  page_published: "page published",
  request_fulfilled: "your request",
  wallet_activity: "wallet",
  scan_complete: "scan",
};

export default function AlertsScreen() {
  const router = useRouter();
  const { signedIn, signedOut } = useSession();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null until this phone's stored registration has been read.
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (signedIn) void beginAlertsVisit().then(setLastVisit);
  }, [signedIn]);

  const load = useCallback(async () => {
    if (!signedIn) {
      setAlerts(null);
      return;
    }
    setError(null);
    try {
      setAlerts(await getFeed());
    } catch (err) {
      setAlerts([]);
      setError(
        err instanceof ApiError && err.status === 404
          ? "Alerts are unavailable right now. Pull down to retry."
          : "Couldn't load. Pull down to retry.",
      );
    }
  }, [signedIn]);

  useEffect(() => {
    void hasRegisteredPushDevice().then(setPushOn);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  /**
   * The switch. On asks for permission and registers this phone; off removes
   * this phone's token from the server (DELETE /api/v1/devices/:token), so
   * pushes stop while the in-app list keeps working. Real state only: the
   * switch moves after the call succeeds, not before.
   */
  const onTogglePush = useCallback(
    async (next: boolean) => {
      if (pushBusy) return;
      setPushBusy(true);
      setPushNote(null);
      try {
        if (next) {
          const result = await registerForPushNotifications();
          if (result.ok && result.registered) setPushOn(true);
          else if (!result.ok) setPushNote(result.message);
        } else {
          const token = await getRegisteredPushToken();
          if (token) await unregisterForPushNotifications(token);
          setPushOn(false);
        }
      } catch {
        setPushNote(next ? "Couldn't turn on push. Try again." : "Couldn't turn off push. Try again.");
      } finally {
        setPushBusy(false);
      }
    },
    [pushBusy],
  );

  if (!signedIn) {
    // Session still loading: show nothing rather than a prompt to sign in.
    if (!signedOut) return <Screen title="alerts">{null}</Screen>;
    return (
      <Screen title="alerts">
        <Card>
          <Prose tone="secondary">
            <SignInLink /> to get alerts.
          </Prose>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="alerts"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={color.textMuted}
          colors={[color.textMuted]}
        />
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Prose weight="medium">Push notifications</Prose>
        <Switch
          value={pushOn === true}
          // Disabled until the stored state has been read, and while a call is in flight.
          disabled={pushOn === null || pushBusy}
          onValueChange={(next) => void onTogglePush(next)}
          trackColor={{ false: color.borderDefault, true: color.textMuted }}
          thumbColor={pushOn ? color.textPrimary : color.textSecondary}
          accessibilityLabel="Push notifications"
        />
      </View>
      {pushNote ? (
        <Mono size="micro" tone="muted" style={{ marginTop: space.sm }}>
          {pushNote}
        </Mono>
      ) : null}

      <View style={{ height: space.lg }} />

      {alerts === null ? <ActivityIndicator color={color.textMuted} /> : null}

      {error ? (
        <Card style={{ marginBottom: space.lg }}>
          <Prose tone="secondary">{error}</Prose>
        </Card>
      ) : null}

      {alerts !== null && alerts.length === 0 && !error ? (
        <Card>
          <Prose tone="secondary">
            Nothing yet. Follow a page to hear when its score moves.
          </Prose>
        </Card>
      ) : null}

      <View style={{ gap: space.md }}>
        {(alerts ?? []).map((alert) => (
          <Pressable
            key={String(alert.id)}
            onPress={() => alert.slug && router.push(`/entity/${alert.slug}`)}
            disabled={!alert.slug}
          >
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                {lastVisit && Date.parse(alert.created_at) > Date.parse(lastVisit) ? <NewMarker /> : null}
                <Mono size="micro" label tone="muted">
                  {KIND_LABEL[alert.kind]} · {relativeTime(alert.created_at)}
                </Mono>
              </View>
              <Prose weight="medium" style={{ marginTop: space.sm }}>
                {alert.title}
              </Prose>
              <Prose tone="secondary" style={{ marginTop: 2 }}>
                {alert.body}
              </Prose>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
