/**
 * One button of the page screen's action block. Every button in the block is
 * this component, so they share a label style (mono caps, the app's primary
 * action look) and a minimum height; a long label wraps to two lines inside
 * the same box. `flex: 1` makes a lone last button span the whole row.
 */
import { Pressable, View } from "react-native";
import { Mono } from "../design";
import { border, color, radius, space } from "../design/tokens";

export function ActionButton({
  label,
  sublabel,
  onPress,
  disabled = false,
  highlight = false,
  accessibilityHint,
}: {
  label: string;
  /** Smaller second line inside the button ("since yesterday"). */
  sublabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Promoted look: cyan border, cyan label, faint cyan fill (Submit evidence on a recently updated page). */
  highlight?: boolean;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <View
          style={{
            flex: 1,
            minHeight: 56,
            justifyContent: "center",
            alignItems: "center",
            borderWidth: border.width,
            borderStyle: pressed || highlight ? "solid" : border.style,
            borderColor: disabled ? color.borderMuted : highlight ? color.accentAnchor : color.borderDefault,
            backgroundColor: highlight && !disabled ? "rgba(34,211,238,0.07)" : undefined,
            borderRadius: radius.card,
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
          }}
        >
          <Mono
            size="label"
            label
            weight="medium"
            color={disabled ? color.textMuted : highlight ? color.accentAnchor : color.textPrimary}
            style={{ textAlign: "center" }}
          >
            {label}
          </Mono>
          {sublabel ? (
            <Mono size="micro" tone={highlight && !disabled ? "secondary" : "muted"} style={{ textAlign: "center", marginTop: 2 }}>
              {sublabel}
            </Mono>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}
