import { useEffect, useRef } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import { color, radius, space } from "../tokens";
import { Mono } from "./Text";
import { useReducedMotion } from "./useReducedMotion";

/**
 * A row of segments, one per step, that light up in the app's cyan as the work
 * moves along. Steps before `current` are lit, `current` is lit and gently
 * pulses (unless `complete` or `stopped`, or "remove animations" is on), later
 * steps are dim. `stopped` paints the current segment red instead.
 */
export function StageProgress({
  steps,
  current,
  complete = false,
  stopped = false,
  style,
}: {
  steps: readonly string[];
  /** Index of the step in progress (or where it stopped). */
  current: number;
  /** Every step is done: all segments solid, nothing pulses. */
  complete?: boolean;
  stopped?: boolean;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const pulsing = !complete && !stopped && !reduced;

  useEffect(() => {
    if (!pulsing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulsing, pulse]);

  const here = steps[Math.min(Math.max(current, 0), steps.length - 1)];
  const summary = complete
    ? `All ${steps.length} steps done`
    : `${stopped ? "Stopped at" : "Step"} ${current + 1} of ${steps.length}: ${here}`;

  return (
    <View accessible accessibilityLabel={summary} style={[{ flexDirection: "row", gap: space.xs }, style]}>
      {steps.map((label, i) => {
        const done = complete || i < current;
        const isCurrent = !complete && i === current;
        const lit = done || isCurrent;
        const tint = isCurrent && stopped ? color.accentCritical : color.accentAnchor;
        return (
          <View key={label} style={{ flex: 1 }}>
            <Animated.View
              style={{
                height: 6,
                borderRadius: radius.pill,
                backgroundColor: lit ? tint : color.borderDefault,
                opacity: isCurrent && pulsing ? pulse : 1,
              }}
            />
            <Mono
              size="micro"
              label
              numberOfLines={2}
              tone={lit ? "primary" : "muted"}
              color={isCurrent && stopped ? color.accentCritical : undefined}
              style={{ marginTop: space.xs }}
            >
              {label}
            </Mono>
          </View>
        );
      })}
    </View>
  );
}
