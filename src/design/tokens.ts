/**
 * Design tokens ported from web/DESIGN.md §8 (colour) and §7 (type).
 *
 * The web app expresses these as Tailwind classes; React Native has no
 * Tailwind, so the hexes are lifted verbatim from the DESIGN.md token table
 * rather than re-derived. Anything that changes a value here is a brand
 * change and belongs in DESIGN.md first.
 *
 * Dark by default — DESIGN.md: "Light mode is post-hackathon."
 */
export const color = {
  /** Page background. */
  bgBase: "#0a0a0a",
  /** Slightly lifted surface for cards; still paper-and-ink, no elevation. */
  bgRaised: "#0f0f11",
  /** Grid overlay dots. */
  bgGrid: "rgba(255,255,255,0.04)",

  /** Default dashed border (zinc-800). */
  borderDefault: "#27272a",
  /** Subtle dividers. */
  borderMuted: "#1f1f23",

  textPrimary: "#ededed",
  /** Captions, metadata (zinc-400). */
  textSecondary: "#a1a1aa",
  /** Tertiary, disabled (zinc-500). */
  textMuted: "#71717a",

  /** WARNING / high severity (orange-500). */
  accentWarning: "#f97316",
  /** CRITICAL (red-500). */
  accentCritical: "#ef4444",
  /** CAUTION / medium severity (yellow-500). */
  accentCaution: "#eab308",
  /** VERIFIED / low severity (green-500). */
  accentVerified: "#22c55e",
  /** DISPUTED — orthogonal to severity (purple-500). */
  accentDisputed: "#a855f7",
  /**
   * On-chain anchor links, matching the website's cyan (~cyan-400). A
   * teal-cyan, not the saturated blue DESIGN.md §12 bans; it marks "on chain".
   */
  accentAnchor: "#22d3ee",

  /**
   * Wallet-action buttons only (WalletButton): the "Seeker" look, a metallic
   * silver pill with a soft teal glow. Vertical gradient stops, top to bottom
   * (the 46%/54% pair makes the hard "horizon" of a metal bar).
   */
  walletSilverTop: "#fbfcfc",
  walletSilverMid1: "#dfe5e5",
  walletSilverMid2: "#b9c3c3",
  walletSilverBottom: "#fbfcfc",
  /** 1px inner highlight along the top edge. */
  walletHighlight: "rgba(255,255,255,0.9)",
  /** Near-black label on the silver (about 18:1). */
  walletText: "#0b0f0f",
  /** Teal glow ring (1px) and shadow around the pill. */
  walletGlow: "rgba(45,212,191,0.35)",
  walletGlowShadow: "#2dd4bf",
  /** Disabled: flat grey pill, muted label. */
  walletDisabledFrom: "#2a3a38",
  walletDisabledTo: "#3a4a47",
  walletDisabledText: "#9aa9a6",
  /** Optional dark-teal "aurora" panel behind the pill. */
  walletPanelBg: "#0b3b38",
  walletPanelBorder: "#1d3b39",
  walletPanelAqua: "rgba(127,245,230,0.55)",
  walletPanelTeal: "rgba(45,212,191,0.18)",
  /** Body text inside the aurora panel (light teal on the dark panel). */
  walletPanelText: "#bfeee8",
} as const;

export type ColorToken = keyof typeof color;

/**
 * DESIGN.md §12 bans saturated blue outright. Kept as a named export so a
 * reviewer can grep for it and find the rule rather than the colour.
 */
export const BANNED_HUES = ["blue"] as const;

/** 4px base scale. DESIGN.md's card padding (`p-6`) is 24. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** DESIGN.md §9: "border-radius: 4px (sharper than default)". */
export const radius = {
  card: 4,
  pill: 2,
  /** WalletButton pill: fully rounded. */
  wallet: 999,
  /** WalletButton aurora panel. */
  walletPanel: 16,
} as const;

/** DESIGN.md §9: 1px dashed everywhere; 2px severity edge bar. */
export const border = {
  width: 1,
  style: "dashed" as const,
  edgeBarWidth: 2,
};

/**
 * Three sizes per surface, no more (DESIGN.md §7: "never more than 3 type
 * sizes per surface").
 */
export const fontSize = {
  display: 28,
  heading: 17,
  body: 15,
  label: 11,
  micro: 10,
} as const;

export const lineHeight = {
  body: 22,
  heading: 22,
} as const;

/** DESIGN.md §7: data/labels are uppercase with wide tracking. */
export const tracking = {
  label: 1.2,
  tight: -0.4,
} as const;

/**
 * Chrome heights two files have to agree on. `Screen` cannot read the tab
 * bar's height from React Navigation (the context lives behind an
 * expo-router internal path), so the number lives here and
 * `app/(tabs)/_layout.tsx` sets the bar from it (plus the bottom safe-area inset).
 */
export const layout = {
  /** Tab bar content height, excluding the bottom inset: a 22px icon over a one-line label. */
  tabBarHeight: 64,
} as const;
