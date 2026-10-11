/**
 * What this phone remembers between visits — the "last seen" markers behind
 * the retention loops (docs/RETENTION_LOOPS_SPEC.md §4, Loops 2, 3 and 6).
 *
 * ON THE DEVICE, NOT THE SERVER. The spec (§3) and the owner's cost rule are
 * the same instruction from two sides: a cached page cannot know who is
 * looking, and every request is a billed Vercel invocation. So nothing here
 * talks to the network. The markers live in AsyncStorage (plain app storage,
 * not the keystore — none of it is a credential), and the server never learns
 * which pages anyone opened.
 *
 * WHAT IS STORED, AND THE CAPS:
 *   pages     slug → {entity_name, score, updated_at, seenAt}   ≤ 300 pages
 *   home      when the Search tab was last opened
 *   watch     when the Watch tab was last opened + each follow's score then
 *   alerts    when the Alerts tab was last opened
 *   scans     wallet address → last scan's holdings (mint, symbol, slug,
 *             score) and exposure score                          ≤ 10 wallets
 *   requests  investigation requests made from this phone        ≤ 20
 *
 * The scan snapshot does keep a wallet address on the phone. It is the user's
 * own phone, the address is public on-chain, and it is what "re-scan" needs;
 * it is never sent anywhere except in the body of the scan the user asks for.
 * "Forget" on the Scan tab removes it.
 *
 * FAILURE IS SILENT AND HARMLESS. Every read and write is wrapped: a phone
 * whose storage throws simply shows no "since your last visit" line, which
 * is exactly what a first-time visitor sees. Nothing here can break a screen.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PageSnapshot, ScanSnapshot, WatchSnapshot } from "./diff";

const KEY = {
  pages: "avoid.retention.pages.v1",
  home: "avoid.retention.home.v1",
  watch: "avoid.retention.watch.v1",
  alerts: "avoid.retention.alerts.v1",
  scans: "avoid.retention.scans.v1",
  requests: "avoid.retention.requests.v1",
} as const;

const MAX_PAGES = 300;
const MAX_SCANS = 10;
const MAX_REQUESTS = 20;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the loop quietly goes without a marker.
  }
}

/** Keep the `max` newest entries of a record, by an ISO field. */
function capByNewest<T>(record: Record<string, T>, max: number, at: (v: T) => string): Record<string, T> {
  const entries = Object.entries(record);
  if (entries.length <= max) return record;
  entries.sort(([, a], [, b]) => Date.parse(at(b)) - Date.parse(at(a)));
  return Object.fromEntries(entries.slice(0, max));
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function readAllPages(): Promise<Record<string, PageSnapshot>> {
  return (await readJson<Record<string, PageSnapshot>>(KEY.pages)) ?? {};
}

export async function readPage(slug: string): Promise<PageSnapshot | null> {
  return (await readAllPages())[slug] ?? null;
}

/**
 * Record that the reader has now seen this page as it is.
 *
 * `newestShown` is the created_at of the newest decision on screen. The
 * marker is the later of it and the phone's clock, so a phone whose clock
 * runs slow does not mark rows it has already shown as NEW next time
 * (the comparison is against server timestamps).
 */
export async function rememberPage(
  snapshot: Omit<PageSnapshot, "seenAt">,
  newestShown?: string | null,
): Promise<void> {
  const all = await readAllPages();
  const now = Date.now();
  const shown = newestShown ? Date.parse(newestShown) : Number.NaN;
  const seenAt = new Date(Number.isNaN(shown) ? now : Math.max(now, shown)).toISOString();
  all[snapshot.slug] = { ...snapshot, seenAt };
  await writeJson(KEY.pages, capByNewest(all, MAX_PAGES, (p) => p.seenAt));
}

// ---------------------------------------------------------------------------
// Tab visits — one marker per app session
// ---------------------------------------------------------------------------

/**
 * The PREVIOUS visit's marker, captured once per app process.
 *
 * The first call in a process reads the stored marker, then overwrites it with
 * "now". Every later call in the same process returns the same captured value,
 * so a pull-to-refresh or a tab being re-mounted does not reset "since your
 * last visit" to zero seconds ago. The next launch compares against this one.
 */
const captured: Partial<Record<"home" | "alerts", Promise<string | null>>> = {};

function beginVisit(which: "home" | "alerts"): Promise<string | null> {
  const existing = captured[which];
  if (existing) return existing;
  const key = KEY[which];
  const promise = (async () => {
    const previous = await readJson<{ seenAt: string }>(key);
    await writeJson(key, { seenAt: new Date().toISOString() });
    return previous?.seenAt ?? null;
  })();
  captured[which] = promise;
  return promise;
}

export function beginHomeVisit(): Promise<string | null> {
  return beginVisit("home");
}

export function beginAlertsVisit(): Promise<string | null> {
  return beginVisit("alerts");
}

/**
 * The Watch tab's marker carries each follow's score as well as the time, so
 * a score that moved outside the activity feed's window is still caught. The
 * previous snapshot is captured once per process, like the others; the new one
 * is written by the caller once it knows the current scores.
 */
let watchCaptured: Promise<WatchSnapshot | null> | null = null;

export function previousWatchSnapshot(): Promise<WatchSnapshot | null> {
  if (!watchCaptured) watchCaptured = readJson<WatchSnapshot>(KEY.watch);
  return watchCaptured;
}

export async function rememberWatch(scores: Record<string, number | null>): Promise<void> {
  await writeJson(KEY.watch, { seenAt: new Date().toISOString(), scores } satisfies WatchSnapshot);
}

// ---------------------------------------------------------------------------
// Wallet scans
// ---------------------------------------------------------------------------

export type StoredScan = ScanSnapshot & { address: string };

async function readScans(): Promise<Record<string, StoredScan>> {
  return (await readJson<Record<string, StoredScan>>(KEY.scans)) ?? {};
}

export async function readScan(address: string): Promise<StoredScan | null> {
  return (await readScans())[address] ?? null;
}

/** Most recently scanned first — the Scan tab's "scan again" list. */
export async function listScannedWallets(): Promise<StoredScan[]> {
  return Object.values(await readScans()).sort(
    (a, b) => Date.parse(b.scannedAt) - Date.parse(a.scannedAt),
  );
}

export async function rememberScan(scan: StoredScan): Promise<void> {
  const all = await readScans();
  all[scan.address] = scan;
  await writeJson(KEY.scans, capByNewest(all, MAX_SCANS, (s) => s.scannedAt));
}

export async function forgetScan(address: string): Promise<void> {
  const all = await readScans();
  delete all[address];
  await writeJson(KEY.scans, all);
}

// ---------------------------------------------------------------------------
// Requests made from this phone
// ---------------------------------------------------------------------------

export type StoredRequest = { id: string; entity: string; created_at: string };

export async function listDeviceRequests(): Promise<StoredRequest[]> {
  return (await readJson<StoredRequest[]>(KEY.requests)) ?? [];
}

/**
 * Remember a request this phone made, so Profile can show its outcome even for
 * someone who never signs in. Newest first, de-duplicated by id.
 */
export async function rememberDeviceRequest(request: StoredRequest): Promise<void> {
  const list = (await listDeviceRequests()).filter((r) => r.id !== request.id);
  list.unshift(request);
  await writeJson(KEY.requests, list.slice(0, MAX_REQUESTS));
}
