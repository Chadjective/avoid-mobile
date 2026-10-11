import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { color } from "../tokens";
import { useReducedMotion } from "./useReducedMotion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A ring that fills clockwise from the top as `fraction` goes 0 → 1, with
 * whatever you pass as children in the middle.
 *
 * It owns no clock. The caller feeds it a new fraction (the request screen does
 * so once a second from a local timer) and the arc glides to it, so the motion
 * is smooth between ticks. With "remove animations" on it jumps instead.
 * The fill is `color.accentAnchor`, the app's cyan.
 */
export function ProgressArc({
  fraction,
  size = 168,
  strokeWidth = 10,
  tint = color.accentAnchor,
  glideMs = 1000,
  children,
  style,
  accessibilityLabel,
}: {
  /** 0..1; anything outside is clamped. */
  fraction: number;
  size?: number;
  strokeWidth?: number;
  tint?: string;
  /** How long to take reaching a new fraction. 1000 matches a one-second tick. */
  glideMs?: number;
  children?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const value = useRef(new Animated.Value(target)).current;

  useEffect(() => {
    if (reduced) {
      value.setValue(target);
      return;
    }
    const anim = Animated.timing(value, {
      toValue: target,
      duration: glideMs,
      easing: Easing.linear,
      useNativeDriver: false, // strokeDashoffset is an SVG prop, not a transform
    });
    anim.start();
    return () => anim.stop();
  }, [target, glideMs, reduced, value]);

  const dashOffset = value.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}
    >
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color.borderDefault}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tint}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          // Start at 12 o'clock rather than 3.
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}
