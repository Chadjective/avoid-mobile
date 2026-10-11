/**
 * DESIGN.md §5: "Mono for data, sans for prose. Hashes, addresses,
 * signatures, timestamps, slot numbers, status labels → mono. Narrative → sans."
 * Two components so the choice is made at the call site and is greppable.
 */
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { color, fontSize, lineHeight, tracking } from "../tokens";
import { fontFamily } from "../fonts";

type Tone = "primary" | "secondary" | "muted";

const TONE: Record<Tone, string> = {
  primary: color.textPrimary,
  secondary: color.textSecondary,
  muted: color.textMuted,
};

export type AppTextProps = TextProps & {
  tone?: Tone;
  size?: keyof typeof fontSize;
  weight?: "regular" | "medium" | "semibold";
  /** Uppercase + wide tracking, the DESIGN.md treatment for data labels. */
  label?: boolean;
  color?: string;
};

/** Mono — data, labels, hashes, scores, timestamps. */
export function Mono({
  tone = "primary",
  size = "body",
  weight = "regular",
  label = false,
  color: override,
  style,
  ...rest
}: AppTextProps) {
  const family =
    weight === "semibold"
      ? fontFamily.monoSemiBold
      : weight === "medium"
        ? fontFamily.monoMedium
        : fontFamily.mono;

  const base: TextStyle = {
    fontFamily: family,
    fontSize: fontSize[size],
    color: override ?? TONE[tone],
  };
  if (label) {
    base.textTransform = "uppercase";
    base.letterSpacing = tracking.label;
  }
  return <RNText {...rest} style={[base, style]} />;
}

/** Sans — narrative prose only. */
export function Prose({
  tone = "primary",
  size = "body",
  weight = "regular",
  color: override,
  style,
  ...rest
}: Omit<AppTextProps, "label">) {
  const family =
    weight === "semibold"
      ? fontFamily.sansSemiBold
      : weight === "medium"
        ? fontFamily.sansMedium
        : fontFamily.sans;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: family,
          fontSize: fontSize[size],
          lineHeight: lineHeight.body,
          color: override ?? TONE[tone],
        },
        style,
      ]}
    />
  );
}
