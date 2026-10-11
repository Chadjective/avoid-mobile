/**
 * Landing route for the email magic link: `avoid://auth`.
 *
 * Supabase sends the user's browser to `avoid://auth?...` (or `#...`); Android
 * hands that to this app through the intent filter in app.json, and Expo
 * Router mounts this screen. It reads the RAW url with expo-linking rather than
 * the router's params, because the router drops the `#fragment`, which is
 * where the implicit flow puts the tokens.
 *
 * Two sources, because neither is enough alone:
 *   - `Linking.useURL()` sees the `#fragment`, but only for a cold start. When
 *     the app is already open (the usual case: the user just tapped "Send
 *     link"), the `url` event fires while the router is still pushing this
 *     route, before this screen subscribes, so useURL stays null. That is the
 *     "No sign-in link was received" a device showed on 2026-10-03.
 *   - The router's own params carry the `?query` on both cold and warm starts.
 *     The Supabase client uses the PKCE flow (src/api/supabase.ts), so the link
 *     comes back as `avoid://auth?code=...` and the params alone are enough.
 * The same effect runs once per distinct link (a code is single-use, so a
 * re-render must not spend it twice).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import * as Linking from "expo-linking";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Mono, Prose, space, color } from "@/src/design";
import { getSupabase, isSupabaseConfigured } from "@/src/api/supabase";
import { parseAuthLink, isAuthLink } from "@/src/session/auth-link";

type Phase = { name: "working" } | { name: "done" } | { name: "error"; message: string };

const handled = new Set<string>();

export default function AuthLanding() {
  const router = useRouter();
  const linkingUrl = Linking.useURL();
  const params = useLocalSearchParams();
  // The query the router parsed, rebuilt into a URL the shared parser reads.
  const paramsUrl = useMemo(() => {
    const pairs = Object.entries(params).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map(
        (v) => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`,
      ),
    );
    return pairs.length ? `avoid://auth?${pairs.join("&")}` : null;
  }, [params]);
  // The router params win when they carry a sign-in: they are always THIS
  // link. Linking.useURL() can still hold the URL that launched the process
  // (an older, already-spent link), so it is only the fallback, for a cold
  // start or a #fragment the router drops.
  const url =
    paramsUrl && parseAuthLink(paramsUrl).kind !== "none"
      ? paramsUrl
      : linkingUrl && isAuthLink(linkingUrl)
        ? linkingUrl
        : paramsUrl;
  // Whether THIS screen has started an exchange: a second delivery of the
  // same code during one mount is ignored, but a link spent on an earlier
  // visit must say so instead of spinning forever.
  const started = useRef(false);
  const [phase, setPhase] = useState<Phase>({ name: "working" });

  useEffect(() => {
    // useURL is null for a moment on cold start; keep waiting, but do not
    // wait forever when the screen was opened without a link at all.
    if (url === null) {
      const t = setTimeout(
        () =>
          setPhase((p) =>
            p.name === "working"
              ? { name: "error", message: "Link not received." }
              : p,
          ),
        4000,
      );
      return () => clearTimeout(t);
    }
    if (!isAuthLink(url)) return;
    // Keyed by what the link carries, not its spelling: on a cold start the
    // same code can arrive twice (router params first, then Linking), and a
    // second exchange of a single-use code would fail after the first worked.
    const key = JSON.stringify(parseAuthLink(url));
    if (handled.has(key)) {
      if (!started.current) {
        setPhase({
          name: "error",
          message: "Invalid or used link.",
        });
      }
      return;
    }
    handled.add(key);
    started.current = true;

    let active = true;
    const finish = (next: Phase) => {
      if (active) setPhase(next);
    };
    void (async () => {
      const link = parseAuthLink(url);
      if (link.kind === "error") return finish({ name: "error", message: link.message });
      if (link.kind === "none") {
        return finish({ name: "error", message: "Invalid or used link." });
      }
      if (!isSupabaseConfigured()) {
        return finish({ name: "error", message: "This build can't sign in." });
      }
      try {
        const auth = getSupabase().auth;
        const { error } =
          link.kind === "code"
            ? await auth.exchangeCodeForSession(link.code)
            : link.kind === "tokens"
              ? await auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
              : await auth.verifyOtp({ token_hash: link.tokenHash, type: link.type as "email" });
        if (error) {
          return finish({ name: "error", message: "Invalid or used link." });
        }
        finish({ name: "done" });
        setTimeout(() => router.replace("/profile"), 900);
      } catch (err) {
        finish({ name: "error", message: "Sign-in failed. Try again." });
      }
    })();
    // No cleanup flipping `active`: the url is already marked handled, and the
    // session write must finish even if this screen re-renders.
  }, [url, router]);

  return (
    <Screen title="Sign in">
      {phase.name === "working" && (
        <>
          <ActivityIndicator color={color.textMuted} style={{ marginBottom: space.md }} />
          <Prose tone="secondary">Signing you in…</Prose>
        </>
      )}
      {phase.name === "done" && (
        <>
          <Mono size="heading" weight="semibold" style={{ marginBottom: space.md }}>
            Signed in
          </Mono>
        </>
      )}
      {phase.name === "error" && (
        <>
          <Mono size="heading" weight="semibold" style={{ marginBottom: space.md }}>
            Sign-in failed
          </Mono>
          <Prose tone="secondary" style={{ marginBottom: space.lg }}>
            {phase.message}
          </Prose>
          <Link href="/profile">
            <Prose color={color.textPrimary} style={{ textDecorationLine: "underline" }}>
              Go to Profile
            </Prose>
          </Link>
        </>
      )}
    </Screen>
  );
}
