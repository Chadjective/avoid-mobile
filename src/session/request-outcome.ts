/**
 * What Profile's request box does with a 200 from POST /api/requests that
 * carries no request row. Pure, so tests/signin.test.mjs covers it.
 *
 * `slug` alone means "already published" and the app can open /entity/<slug>.
 * A DRAFT page answers the same way but 404s in the app, so it gets the
 * server's sentence and no link to the page. The server is adding `draft:
 * true`; until it ships, the sentence "This page is already being prepared."
 * is the tell.
 */
export const DRAFT_MESSAGE = "This page is already being prepared.";

export type ExistsOutcome = { note: string; openSlug: string | null };

export function requestExistsOutcome(res: {
  slug?: string;
  draft?: boolean;
  message?: string;
}): ExistsOutcome {
  const message = res.message?.trim() || null;
  const draft = res.draft === true || message === DRAFT_MESSAGE;
  if (res.slug && !draft) {
    return { note: message ?? "Investigation already published.", openSlug: res.slug };
  }
  return { note: message ?? "Request queued.", openSlug: null };
}
