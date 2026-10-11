/**
 * The signed-in account's watchlist, shared by every screen that needs it.
 *
 * The Entity screen needs to know "am I already following this?" to show one
 * honest Follow / Following toggle, and the Watch tab lists the same rows.
 * `GET /api/v1/watchlist` is `private, no-store` — the CDN cannot absorb it,
 * so every call is a billed invocation. Rather than one GET per page opened,
 * the list is fetched ONCE per app session (or per sign-in) and then kept in
 * step locally by the follow / unfollow / mute calls, whose responses carry
 * the row. A pull on the Watch tab is the only other refetch.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  follow as apiFollow,
  listWatchlist,
  setMuted as apiSetMuted,
  unfollow as apiUnfollow,
  type WatchlistItem,
  type WatchTargetKind,
} from "../api/watchlist";
import { ApiError } from "../api/client";

type State = {
  items: WatchlistItem[] | null;
  error: unknown;
  loading: boolean;
};

let state: State = { items: null, error: null, loading: false };
let inFlight: Promise<void> | null = null;
/**
 * Bumped by every reset. A load that started under an earlier generation
 * (the previous account's request, still in flight at sign-out) must not
 * write its answer into the store the next account reads.
 */
let generation = 0;
const listeners = new Set<() => void>();

function set(next: Partial<State>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (state.items && !force) return Promise.resolve();
  set({ loading: true });
  const mine = generation;
  const request = listWatchlist()
    .then((items) => {
      if (mine === generation) set({ items, error: null });
    })
    .catch((error: unknown) => {
      if (mine === generation) set({ error });
    })
    .finally(() => {
      if (mine !== generation) return;
      inFlight = null;
      set({ loading: false });
    });
  inFlight = request;
  return request;
}

/** Forget everything — on sign-out, so the next account starts clean. */
export function resetWatchlist(): void {
  generation += 1;
  inFlight = null;
  state = { items: null, error: null, loading: false };
  for (const listener of listeners) listener();
}

export async function followTarget(target: {
  target_kind: WatchTargetKind;
  slug?: string;
  address?: string;
  chain?: string;
}): Promise<WatchlistItem> {
  const item = await apiFollow(target);
  // Only splice into a list we actually hold. With no full list (it failed
  // or never loaded), a one-row list would pass for the whole watchlist —
  // and the Watch tab would snapshot it — so fetch the real one instead.
  if (state.items) set({ items: [item, ...state.items.filter((i) => i.id !== item.id)] });
  else void load(true);
  return item;
}

export async function unfollowItem(id: string): Promise<void> {
  try {
    await apiUnfollow(id);
  } catch (err) {
    // 404: already gone (unfollowed on another device, or a stale list). The
    // person asked for it to be gone; drop it locally instead of an error.
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }
  if (state.items) set({ items: state.items.filter((i) => i.id !== id) });
}

export async function setItemMuted(id: string, muted: boolean): Promise<void> {
  const item = await apiSetMuted(id, muted);
  if (state.items) set({ items: state.items.map((i) => (i.id === id ? item : i)) });
}

/**
 * The shared list. Loads on first use when `enabled` (signed in); a
 * signed-out caller gets `items: null` and costs nothing.
 */
export function useWatchlist(enabled: boolean) {
  const snapshot = useSyncExternalStore(subscribe, () => state);

  useEffect(() => {
    if (enabled) void load();
    else if (state.items !== null || state.error !== null) resetWatchlist();
  }, [enabled]);

  const refresh = useCallback(() => load(true), []);

  return {
    items: enabled ? snapshot.items : null,
    error: enabled ? snapshot.error : null,
    loading: enabled && snapshot.loading,
    refresh,
  };
}

export function findFollowedPage(items: WatchlistItem[] | null, slug: string): WatchlistItem | null {
  return items?.find((i) => i.target_kind === "investigation" && i.slug === slug) ?? null;
}

export function findFollowedAddress(items: WatchlistItem[] | null, address: string): WatchlistItem | null {
  return items?.find((i) => i.target_kind === "address" && i.address === address) ?? null;
}
