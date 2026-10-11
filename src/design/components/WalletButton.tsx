/**
 * The one filled button in the app, used ONLY for wallet actions (Sign in
 * with Solana, Sign in with this wallet, Connect wallet, Link a wallet). The
 * "Seeker" look: a metallic silver pill with a soft teal glow ring, optionally
 * sitting in a dark-teal "aurora" panel (`panel`). DESIGN.md's "no solid
 * filled buttons" still holds for everything else; this is a deliberate,
 * named exception, so do not reuse it for other actions.
 *
 * Gradients are drawn with react-native-svg (expo-linear-gradient is not
 * installed) at MEASURED pixel sizes: react-native-svg's "100%" resolved to the
 * wrong box on the Seeker (the gradient filled only part of the pill). Until
 * measured, each surface is a solid fill, so nothing renders half-drawn.
 */
import { type ReactNode, useId, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { Prose } from "./Text";
import { color, radius, space } from "../tokens";

type Size = { w: number; h: number };

/** onLayout -> measured size, ignoring no-op updates. */
function useMeasured(): [Size | null, (e: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<Size | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };
  return [size, onLayout];
}

const usable = (s: Size | null): s is Size => !!s && s.w > 0 && s.h > 0;

export function WalletButton({
  label,
  onPress,
  disabled = false,
  panel = false,
  header,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Wrap the pill in the dark-teal aurora panel. */
  panel?: boolean;
  /** Content shown inside the panel above the pill (only with `panel`). */
  header?: ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pillGrad = `wallet-pill-${uid}`;
  const aquaGrad = `wallet-aqua-${uid}`;
  const tealGrad = `wallet-teal-${uid}`;
  const [pillSize, onPillLayout] = useMeasured();
  const [panelSize, onPanelLayout] = useMeasured();

  const pill = (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={panel ? undefined : style}
    >
      {({ pressed }) => (
        // Outer view carries the glow ring and shadow (it must not clip);
        // the inner view clips the gradient to the pill.
        <View
          style={{
            borderRadius: radius.wallet,
            borderWidth: 1,
            borderColor: disabled ? "transparent" : color.walletGlow,
            backgroundColor: disabled ? color.walletDisabledTo : color.walletSilverMid1,
            shadowColor: color.walletGlowShadow,
            shadowOpacity: disabled ? 0 : 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: disabled ? 0 : 4,
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View
            onLayout={onPillLayout}
            style={{
              borderRadius: radius.wallet,
              overflow: "hidden",
              paddingVertical: space.md,
              paddingHorizontal: space.xl,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!disabled && usable(pillSize) ? (
              <Svg
                pointerEvents="none"
                width={pillSize.w}
                height={pillSize.h}
                viewBox={`0 0 ${pillSize.w} ${pillSize.h}`}
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <LinearGradient id={pillGrad} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color.walletSilverTop} />
                    <Stop offset="0.46" stopColor={color.walletSilverMid1} />
                    <Stop offset="0.54" stopColor={color.walletSilverMid2} />
                    <Stop offset="1" stopColor={color.walletSilverBottom} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={pillSize.w} height={pillSize.h} fill={`url(#${pillGrad})`} />
              </Svg>
            ) : null}
            {!disabled ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: space.lg,
                  right: space.lg,
                  height: 1,
                  backgroundColor: color.walletHighlight,
                }}
              />
            ) : null}
            <Prose
              weight="semibold"
              color={disabled ? color.walletDisabledText : color.walletText}
              style={{ textAlign: "center", zIndex: 1 }}
            >
              {label}
            </Prose>
          </View>
        </View>
      )}
    </Pressable>
  );

  if (!panel) return pill;

  return (
    <View
      onLayout={onPanelLayout}
      style={[
        {
          backgroundColor: color.walletPanelBg,
          borderRadius: radius.walletPanel,
          borderWidth: 1,
          borderColor: color.walletPanelBorder,
          overflow: "hidden",
          padding: space.lg,
        },
        style,
      ]}
    >
      {usable(panelSize) ? (
        <Svg
          pointerEvents="none"
          width={panelSize.w}
          height={panelSize.h}
          viewBox={`0 0 ${panelSize.w} ${panelSize.h}`}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <RadialGradient
              id={aquaGrad}
              cx={panelSize.w}
              cy={panelSize.h}
              rx={panelSize.w * 0.8}
              ry={panelSize.h * 1.4}
              fx={panelSize.w}
              fy={panelSize.h}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={color.walletPanelAqua} />
              <Stop offset="1" stopColor={color.walletPanelAqua} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient
              id={tealGrad}
              cx={0}
              cy={0}
              rx={panelSize.w * 0.7}
              ry={panelSize.h * 1.2}
              fx={0}
              fy={0}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={color.walletPanelTeal} />
              <Stop offset="1" stopColor={color.walletPanelTeal} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={panelSize.w} height={panelSize.h} fill={`url(#${tealGrad})`} />
          <Rect x={0} y={0} width={panelSize.w} height={panelSize.h} fill={`url(#${aquaGrad})`} />
        </Svg>
      ) : null}
      {header ? <View style={{ marginBottom: space.md }}>{header}</View> : null}
      {pill}
    </View>
  );
}
