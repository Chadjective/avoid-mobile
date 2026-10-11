/**
 * On-device state for Profile's requests section. AsyncStorage only; nothing
 * here is sent anywhere, and every read/write fails quietly (a phone whose
 * storage throws just shows no NEW markers).
 *
 *   seen published   ids of published requests this phone has acknowledged
 *                    (opened, or present at the first ever visit). A published
 *                    request outside the set is NEW until it is opened.
 *   alerts unread    a count of /api/v1/feed rows newer than the Alerts tab's
 *                    own last-visit marker (src/retention/memory.ts); one
 *                    request, reused for five minutes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFeed } from "../api/feed";
import { markSeen, unreadAlertCount } from "./requests-view";

const SEEN_KEY = "avoid.profile.seenPublished.v1";
/** The key src/retention/memory.ts writes when the Alerts tab is opened. */
const ALERTS_VISIT_KEY = "avoid.retention.alerts.v1";

export async function readSeenPublished(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

export async function writeSeenPublished(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // storage unavailable: no marker next time
  }
}

/** Opening a published request clears its NEW marker. */
export async function acknowledgePublished(id: string): Promise<string[]> {
  const next = markSeen(await readSeenPublished(), id);
  await writeSeenPublished(next);
  return next;
}

async function alertsLastVisit(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_VISIT_KEY);
    const parsed = raw ? (JSON.parse(raw) as { seenAt?: unknown }) : null;
    return typeof parsed?.seenAt === "string" ? parsed.seenAt : null;
  } catch {
    return null;
  }
}

let unreadCache: { at: number; count: number } | null = null;
const UNREAD_MS = 5 * 60_000;

/** Null when the feed could not be read (the strip then hides the cell). */
export async function getUnreadAlerts(): Promise<number | null> {
  if (unreadCache && Date.now() - unreadCache.at < UNREAD_MS) return unreadCache.count;
  try {
    const [items, last] = await Promise.all([getFeed(), alertsLastVisit()]);
    const count = unreadAlertCount(items, last);
    unreadCache = { at: Date.now(), count };
    return count;
  } catch {
    return null;
  }
}

/** Called when the signed-in person changes. */
export function resetUnreadAlerts(): void {
  unreadCache = null;
}
