/**
 * Round [+] button for the Watch header: silver gradient disc, teal glow.
 * Local colour constants because the shared silver tokens (agent A, design
 * tokens) were not in the tree when this was written; swap for tokens later.
 */
import { useId } from "react";
import { Pressable } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from "react-native-svg";

const SILVER_TOP = "#f1f5f9";
const SILVER_BOTTOM = "#94a3b8";
const SILVER_EDGE = "#e2e8f0";
const PLUS = "#0b1f1d";
const GLOW = "#2dd4bf";
const SIZE = 36;

export function AddButton({ onPress, label }: { onPress: () => void; label: string }) {
  const id = `add-grad-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        opacity: pressed ? 0.82 : 1,
        shadowColor: GLOW,
        shadowOpacity: 0.7,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
        backgroundColor: SILVER_BOTTOM,
      })}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={SILVER_TOP} />
            <Stop offset="1" stopColor={SILVER_BOTTOM} />
          </LinearGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 0.5} fill={`url(#${id})`} stroke={SILVER_EDGE} strokeWidth={1} />
        <Line x1={11} y1={SIZE / 2} x2={SIZE - 11} y2={SIZE / 2} stroke={PLUS} strokeWidth={2} strokeLinecap="round" />
        <Line x1={SIZE / 2} y1={11} x2={SIZE / 2} y2={SIZE - 11} stroke={PLUS} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
}
