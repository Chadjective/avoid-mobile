/**
 * DESIGN.md §9: three tiers, all bordered + dashed. "No solid filled buttons."
 * Primary is mono uppercase; secondary sentence case; tertiary is a bare
 * dotted-underline link with no border.
 */
import { Pressable, View, type ViewStyle } from "react-native";
import { Mono, Prose } from "./Text";
import { border, color, radius, space } from "../tokens";

export function Button({
  label,
  onPress,
  tier = "secondary",
  disabled = false,
  tone,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  tier?: "primary" | "secondary" | "tertiary";
  disabled?: boolean;
  tone?: string;
  style?: ViewStyle;
  /** What pressing does, for TalkBack, when the label alone does not say. */
  accessibilityHint?: string;
}) {
  const textColor = disabled ? color.textMuted : (tone ?? color.textPrimary);

  if (tier === "tertiary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
      >
        <Prose
          size="body"
          color={textColor}
          style={{ textDecorationLine: "underline", textDecorationStyle: "dotted" }}
        >
          {label}
        </Prose>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={style}
    >
      {({ pressed }) => (
        <View
          style={{
            borderWidth: border.width,
            // DESIGN.md: "on hover: solid border" — press is the touch analogue.
            borderStyle: pressed ? "solid" : border.style,
            borderColor: disabled ? color.borderMuted : color.borderDefault,
            borderRadius: radius.card,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            alignItems: "center",
          }}
        >
          {tier === "primary" ? (
            <Mono size="label" label weight="medium" color={textColor} style={{ textAlign: "center" }}>
              {label}
            </Mono>
          ) : (
            // Centred so a label that wraps in a half-width button stays tidy.
            <Prose size="body" color={textColor} style={{ textAlign: "center" }}>
              {label}
            </Prose>
          )}
        </View>
      )}
    </Pressable>
  );
}
