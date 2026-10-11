/**
 * Add to watchlist — a hidden tab route opened from the Watch header's [+]
 * (registered with href: null in (tabs)/_layout.tsx). Search with the same
 * endpoint as the Search tab; a result with a page gets Follow; the last row
 * asks for an investigation of what was typed.
 */
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { BandChip, Card, Field, Mono, Prose, Screen, color, space } from "@/src/design";
import { search } from "@/src/api/search";
import type { SearchSuggestion } from "@/src/api/types";
import { createRequest } from "@/src/api/requests";
import { ApiError } from "@/src/api/client";
import { SignInLink, useSession } from "@/src/session";
import { WhileFocused } from "@/src/navigation/hidden-route";
import { findFollowedPage, followTarget, useWatchlist } from "@/src/retention/watchlist-store";

const DEBOUNCE_MS = 350;

export default function WatchAddRoute() {
  // Hidden tab routes stay mounted; remount on each visit so the field is
  // empty and the keyboard opens again.
  return (
    <WhileFocused id="add">
      <WatchAddScreen />
    </WhileFocused>
  );
}

function WatchAddScreen() {
  const router = useRouter();
  const { signedIn, signedOut } = useSession();
  const watchlist = useWatchlist(signedIn);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const q = query.trim();
  useEffect(() => {
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      search(q, controller.signal)
        .then((r) => setResults(r))
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const onFollow = useCallback(async (slug: string) => {
    setBusySlug(slug);
    setNote(null);
    try {
      await followTarget({ target_kind: "investigation", slug });
    } catch (err) {
      setNote(
        err instanceof ApiError && err.status === 409
          ? "Your watchlist is full. Unfollow something first."
          : err instanceof ApiError && err.status === 403
            ? "Pick a handle on the Profile tab first."
            : "Couldn't follow. Try again.",
      );
    } finally {
      setBusySlug(null);
    }
  }, []);

  const onRequest = useCallback(async () => {
    setRequesting(true);
    setNote(null);
    try {
      const result = await createRequest(q);
      if (result.request?.id) router.push(`/request/${result.request.id}`);
      else if (result.slug) router.push(`/entity/${result.slug}`);
      else setNote(result.message ?? "Request received.");
    } catch (err) {
      setNote(
        err instanceof ApiError && err.isRateLimited
          ? "Daily limit reached. Try again tomorrow."
          : "Couldn't send the request. Try again.",
      );
    } finally {
      setRequesting(false);
    }
  }, [q, router]);

  if (signedOut) {
    return (
      <Screen title="add to watchlist">
        <Card>
          <Prose tone="secondary">
            <SignInLink /> to follow pages and wallets.
          </Prose>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="add to watchlist">
      <Pressable onPress={() => router.navigate("/watchlist")} accessibilityRole="button" hitSlop={8}>
        <Mono size="micro" tone="muted" label>
          ← Watchlist
        </Mono>
      </Pressable>
      <View style={{ height: space.md }} />
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search a name, address or domain"
        autoFocus
        returnKeyType="search"
      />
      <View style={{ height: space.md }} />
      {searching ? <ActivityIndicator color={color.textMuted} /> : null}

      <View style={{ gap: space.md }}>
        {(results ?? []).map((r) => {
          const followed = findFollowedPage(watchlist.items, r.slug) !== null;
          return (
            <Card key={r.slug}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/entity/${r.slug}`)}
                  accessibilityRole="link"
                >
                  <Prose weight="medium">{r.entity_name}</Prose>
                  <View style={{ marginTop: space.xs, alignItems: "flex-start" }}>
                    <BandChip score={r.trust_score} />
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => void onFollow(r.slug)}
                  disabled={followed || busySlug === r.slug || !signedIn}
                  accessibilityRole="button"
                  accessibilityLabel={followed ? `Following ${r.entity_name}` : `Follow ${r.entity_name}`}
                  hitSlop={8}
                >
                  <Mono size="micro" label tone={followed ? "muted" : "secondary"}>
                    {followed ? "✓ Following" : busySlug === r.slug ? "Following…" : "Follow"}
                  </Mono>
                </Pressable>
              </View>
            </Card>
          );
        })}

        {q.length >= 2 && results !== null && !searching ? (
          <Pressable
            onPress={() => {
              if (!signedIn) router.push("/profile");
              else void onRequest();
            }}
            disabled={requesting}
            accessibilityRole="button"
            style={{ paddingVertical: space.sm }}
          >
            <Mono size="body" color={color.accentAnchor}>
              {requesting ? "Requesting…" : `Not here? Request "${q}" →`}
            </Mono>
          </Pressable>
        ) : null}
      </View>

      {note ? (
        <Mono size="micro" tone="muted" style={{ marginTop: space.md }}>
          {note}
        </Mono>
      ) : null}
    </Screen>
  );
}
