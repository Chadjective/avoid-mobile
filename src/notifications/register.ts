/**
 * Expo push token registration.
 *
 * docs/MOBILE_APP_SPEC.md D7: delivery is Expo's push service (which fronts
 * FCM on Android) and a Postgres outbox is the queue. The app's whole job is
 * to obtain a token and hand it to the server; nothing in the app ever calls
 * a push provider.
 *
 * contract: docs/MOBILE_APP_SPEC.md §8 — `POST /api/v1/devices` does not exist
 * yet. This module is written against the specified contract so that the
 * moment the route lands, nothing here changes.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { toServerPlatform } from "../api/contracts";
import { registerDevice, unregisterDevice } from "../api/devices";

/**
 * The token this device last handed to POST /api/v1/devices.
 *
 * There is no GET /api/v1/devices — the route file has only a POST and a
 * DELETE — so "does this phone already get pushes?" cannot be asked of the
 * server. Screens that need the answer (the request-status screen offers an
 * email fallback only when push is NOT registered) read it from here, and it
 * is written only after the POST returns.
 */
const REGISTERED_TOKEN_KEY = "avoid.push.registered_token";

export async function getRegisteredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** True when this device has a token the server has accepted. */
export async function hasRegisteredPushDevice(): Promise<boolean> {
  return (await getRegisteredPushToken()) !== null;
}

export type PushRegistration =
  | { ok: true; token: string; registered: boolean }
  | { ok: false; reason: "not_a_device" | "permission_denied" | "no_project_id" | "error"; message: string };

/**
 * Foreground presentation. A push that arrives while the user is looking at
 * the app still shows — the alert IS the product (J3).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs an explicit channel or notifications arrive silently. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("alerts", {
    name: "Watchlist alerts",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    // §6 rule 4: never a wallet address in a push body — it shows on lock
    // screens. PRIVATE visibility is the belt to that rule's braces.
    sound: null,
    vibrationPattern: [0, 200],
    lightColor: "#ededed",
  });
}

/**
 * Ask for permission, get an Expo push token, and POST it to /api/v1/devices.
 * Safe to call on every sign-in: the route is specified as idempotent on token.
 */
export async function registerForPushNotifications(options?: {
  /** Skip the server call — useful before the route exists. */
  skipServer?: boolean;
}): Promise<PushRegistration> {
  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "not_a_device",
      message: "Push needs a real phone, not an emulator.",
    };
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== "granted") {
    return {
      ok: false,
      reason: "permission_denied",
      message: "Push is off. Turn on notifications for AVOID.NET in Settings.",
    };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return {
      ok: false,
      reason: "no_project_id",
      message:
        "Push isn't available in this build. Alerts still show here.",
    };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (options?.skipServer) return { ok: true, token, registered: false };

    await registerDevice({
      expo_push_token: token,
      platform: toServerPlatform(Platform.OS),
      app_version: Constants.expoConfig?.version ?? undefined,
    });
    try {
      await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token);
    } catch {
      // Losing the note costs an unnecessary email prompt, nothing more.
    }
    return { ok: true, token, registered: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // A build without google-services.json (Firebase) cannot get a push token
    // on Android; the library's message is a developer instruction, not a
    // sentence for a person.
    if (/firebase|googleServicesFile/i.test(raw)) {
      return {
        ok: false,
        reason: "error",
        message:
          "Push isn't available in this build. Alerts still show here.",
      };
    }
    return { ok: false, reason: "error", message: "Couldn't turn on push. Try again." };
  }
}

/** contract: docs/MOBILE_APP_SPEC.md §8 — called on sign-out. */
export async function unregisterForPushNotifications(token: string): Promise<void> {
  await unregisterDevice(token);
  try {
    await AsyncStorage.removeItem(REGISTERED_TOKEN_KEY);
  } catch {
    // nothing to do
  }
}
