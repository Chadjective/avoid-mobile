/**
 * Handles taps on notifications: the response that launched the app (cold
 * start) and taps while it is running. Routing itself lives in ./route.ts.
 */
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { routeForNotificationData } from "./route";

/** Ids already routed, so cold start + listener never navigate twice. */
const handled = new Set<string>();

function handle(response: Notifications.NotificationResponse | null | undefined): void {
  if (!response) return;
  // Only the default tap; ignore dismiss or custom action identifiers.
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  const data = response.notification.request.content.data;
  try {
    router.push(routeForNotificationData(data) as never);
    // Marked only after a successful push, so a tap that arrives before the
    // navigator exists is retried when `enabled` flips.
    handled.add(id);
  } catch {
    // Navigator not mounted yet.
  }
}

/**
 * Mount once in the root layout. Pass `enabled` = the navigator is rendered
 * (the layout shows a spinner, with no Stack, until fonts load).
 */
export function useNotificationTapRouting(enabled: boolean): void {
  const last = Notifications.useLastNotificationResponse();

  // Cold start / background launch: the hook yields the launching response.
  useEffect(() => {
    if (enabled) handle(last);
  }, [last, enabled]);

  // Taps while the JS runtime is alive.
  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [enabled]);
}
