/**
 * Bracket status pill, ported from web/src/components/ui/StatusPill.tsx.
 * DESIGN.md §9: mono uppercase, 1px dashed border in the semantic colour,
 * always wrapped in literal brackets.
 */
import { View, type ViewStyle } from "react-native";
import { Mono } from "./Text";
import { border, color, radius } from "../tokens";

export type PillTone =
  | "critical"
  | "warning"
  | "caution"
  | "verified"
  | "disputed"
  | "neutral";

/** Same tone → colour mapping as the web TONE_CLASSES, as hexes. */
const TONE_COLOR: Record<PillTone, { border: string; text: string }> = {
  critical: { border: "rgba(239,68,68,0.6)", text: "#f87171" },
  warning: { border: "rgba(249,115,22,0.6)", text: "#fb923c" },
  caution: { border: "rgba(234,179,8,0.6)", text: "#facc15" },
  verified: { border: "rgba(34,197,94,0.6)", text: "#4ade80" },
  disputed: { border: "rgba(168,85,247,0.6)", text: "#c084fc" },
  neutral: { border: color.borderDefault, text: color.textMuted },
};

export function StatusPill({
  label,
  tone = "neutral",
  style,
}: {
  label: string;
  tone?: PillTone;
  style?: ViewStyle;
}) {
  const c = TONE_COLOR[tone];
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          borderWidth: border.width,
          borderStyle: border.style,
          borderColor: c.border,
          borderRadius: radius.pill,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <Mono size="micro" label color={c.text}>
        [{label}]
      </Mono>
    </View>
  );
}
