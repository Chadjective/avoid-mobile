/**
 * DESIGN.md §9: 1px dashed border, 4px radius, p-6, no shadow, no gradient,
 * optional 2px severity edge bar on the LEFT edge (axis C — never a pill).
 */
import { View, type ViewProps } from "react-native";
import { border, color, radius, space } from "../tokens";
import { SEVERITY_BAR_COLOR, type Severity } from "../bands";

export function Card({
  severity,
  padded = true,
  style,
  children,
  ...rest
}: ViewProps & { severity?: Severity; padded?: boolean }) {
  return (
    <View
      {...rest}
      style={[
        {
          borderWidth: border.width,
          borderStyle: border.style,
          borderColor: color.borderDefault,
          borderRadius: radius.card,
          backgroundColor: color.bgRaised,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {severity ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: border.edgeBarWidth,
            backgroundColor: SEVERITY_BAR_COLOR[severity],
          }}
        />
      ) : null}
      <View style={padded ? { padding: space.lg } : undefined}>{children}</View>
    </View>
  );
}

/** A hairline divider — DESIGN.md border-muted. */
export function Divider({ style }: { style?: ViewProps["style"] }) {
  return (
    <View
      style={[
        { height: 1, backgroundColor: color.borderMuted, marginVertical: space.md },
        style,
      ]}
    />
  );
}
