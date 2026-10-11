/**
 * The trust-score band scale, ported from web/src/lib/trust-bands.ts
 * (bandForPageScore): CRITICAL 0-25, WARNING 26-50, CAUTIONARY 51-75,
 * LOW RISK 76-100. The app uses this ONE scale everywhere (page gauge and
 * every list chip). The web's five-step corpus-browsing scale is deliberately
 * not ported: two scales on one screen confused people.
 */

// ---------------------------------------------------------------------------
// A. The FOUR-band trust scale: the ONE scale, on pages and in every list chip.
// ---------------------------------------------------------------------------

// The top band was VERIFIED until Sept 2026 and is now LOW RISK (machine value
// LOW_RISK), matching web/src/lib/trust-bands.ts; VERIFIED collided with the
// fact-check lifecycle pill. `band` is the machine value the API returns,
// `label` is the pill text.
export type PageTrustBand = "CRITICAL" | "WARNING" | "CAUTIONARY" | "LOW_RISK";

/** Display text for each machine value. */
export const PAGE_TRUST_BAND_LABELS: Readonly<Record<PageTrustBand, string>> = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  CAUTIONARY: "CAUTIONARY",
  LOW_RISK: "LOW RISK",
};

/**
 * Normalise a `band` from the API. A server older than the rename still sends
 * "VERIFIED" for 76–100; read it as LOW_RISK so this build works against both.
 */
export function normalizePageTrustBand(
  raw: PageTrustBand | "VERIFIED",
): PageTrustBand {
  return raw === "VERIFIED" ? "LOW_RISK" : raw;
}

/** The subset of pill tones that bands use. */
export type PageTrustBandTone = "critical" | "warning" | "caution" | "verified";

export type PageTrustBandStep = {
  band: PageTrustBand;
  label: string;
  tone: PageTrustBandTone;
  stroke: string;
};

/** Identical thresholds and strokes to web bandForPageScore(). */
export function bandForPageScore(score: number): PageTrustBandStep {
  if (score <= 25) return step("CRITICAL", "critical", "#ef4444");
  if (score <= 50) return step("WARNING", "warning", "#f97316");
  if (score <= 75) return step("CAUTIONARY", "caution", "#eab308");
  return step("LOW_RISK", "verified", "#22c55e");
}

function step(band: PageTrustBand, tone: PageTrustBandTone, stroke: string): PageTrustBandStep {
  return { band, label: PAGE_TRUST_BAND_LABELS[band], tone, stroke };
}

/**
 * Band machine value for a score that may be absent. Null in, null out — a page with
 * no score has no verdict, and "CRITICAL" is the wrong default for "unknown".
 */
export function bandValueForScore(score: number | null | undefined): PageTrustBand | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  return bandForPageScore(score).band;
}

// ---------------------------------------------------------------------------
// B. Section severity (DESIGN.md axis C) — the left edge bar, never a pill.
// ---------------------------------------------------------------------------

export type Severity = "low" | "medium" | "high" | "critical";

/** Ported from web/src/components/ui/Card.tsx SEVERITY_BAR, alpha folded in. */
export const SEVERITY_BAR_COLOR: Record<Severity, string> = {
  low: "rgba(34,197,94,0.6)",
  medium: "rgba(234,179,8,0.7)",
  high: "rgba(249,115,22,0.8)",
  critical: "rgba(239,68,68,0.9)",
};

export function isSeverity(value: unknown): value is Severity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}
