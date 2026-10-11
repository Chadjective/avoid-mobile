/**
 * Where the app talks to. Defaults to production; EXPO_PUBLIC_API_BASE points
 * it somewhere else (a laptop, a preview deployment) without a rebuild of the
 * client code — Expo inlines EXPO_PUBLIC_* at bundle time.
 *
 * The apex, not www: web/vercel.json 308-redirects www.avoid.net to
 * avoid.net, and Android's HTTP stack drops the Authorization header when a
 * redirect changes host, so every signed-in call through www arrives as
 * "Not signed in".
 */
const RAW_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://avoid.net";

/** No trailing slash, so `${API_BASE}/api/v1/...` is always well-formed. */
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

/** The canonical web page for a slug — used for "open on the web" links. */
export function webUrl(slug: string): string {
  return `${API_BASE}/${slug}`;
}
