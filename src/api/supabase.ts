/**
 * The Supabase client the app authenticates with.
 *
 * docs/MOBILE_APP_SPEC.md §4.1: "The app never talks to Supabase's database
 * directly for reads; it goes through /api/v1 so the CDN absorbs the traffic.
 * It *does* talk to Supabase Auth directly to sign in." So this client exists
 * for `auth` (and, later, one Realtime channel) — never for `.from(...)`.
 *
 * The anon key here is the same public value the web app ships in
 * NEXT_PUBLIC_SUPABASE_ANON_KEY. The service key never reaches a client.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { secureStorage } from "./secure-storage";

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export function isSupabaseConfigured(): boolean {
  return url.length > 0 && anonKey.length > 0;
}

/**
 * Which EXPO_PUBLIC_* values this build was compiled without. Expo inlines
 * them at bundle time, so this is a fact about the APK, not about the phone —
 * the only fix is another build. The Profile screen names them so a bug report
 * says which half is missing (see mobile/eas.json and the README's "Build an
 * APK": the anon key comes from an EAS environment variable).
 */
export function missingSupabaseKeys(): string[] {
  const missing: string[] = [];
  if (url.length === 0) missing.push("EXPO_PUBLIC_SUPABASE_URL");
  if (anonKey.length === 0) missing.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

let client: SupabaseClient | null = null;

/**
 * Throws when the build has no Supabase env. Screens call
 * `isSupabaseConfigured()` first and render a "not configured" state rather
 * than crashing, so a scaffold build without secrets is still browsable.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (see mobile/.env.example).",
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: secureStorage,
        // A native app has no URL bar and no cookie jar: the session is
        // persisted by us, refreshed by the client, and never parsed out of a
        // location (the magic-link deep link is handled explicitly instead).
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // PKCE: the magic link returns as avoid://auth?code=..., a query the
        // router keeps on a warm start, instead of the implicit flow's
        // #access_token fragment, which only Linking sees and only on a cold
        // start (app/auth.tsx). The code verifier lives in secureStorage, so
        // the link must be opened on the phone that asked for it.
        flowType: "pkce",
      },
    });
  }
  return client;
}

/** The current access token, or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}
