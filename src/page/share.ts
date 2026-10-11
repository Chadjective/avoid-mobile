/**
 * Pure builder for the page Share sheet (app/entity/[slug].tsx). Kept free of
 * React Native so `npm run test:logic` covers it. Android ignores
 * `Share.share({ url })`, so the link is also the last line of `message`.
 * No tracking parameters: the URL is the plain page address. Import-free like
 * the other tested helpers; the caller supplies the band label from
 * src/design/bands.ts (bandForPageScore(score).label).
 */
export type SharePayload = { message: string; url: string; title: string };

export function buildSharePayload(input: {
  name: string;
  score: number | null | undefined;
  /** Band label for `score` (e.g. "LOW RISK"); ignored when there is no score. */
  bandLabel?: string | null;
  reviewed: boolean;
  url: string;
}): SharePayload {
  const { name, score, bandLabel, reviewed, url } = input;
  const hasScore = typeof score === "number" && Number.isFinite(score);
  let headline = `${name} on AVOID.NET`;
  if (hasScore) {
    headline = `${name} scores ${Math.round(score)}/100${bandLabel ? ` (${bandLabel})` : ""} on AVOID.NET`;
  }
  if (reviewed) headline += " · fact-checked";
  return { message: `${headline}\n${url}`, url, title: name };
}
