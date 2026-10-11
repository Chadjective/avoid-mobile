/**
 * Trust score ring gauge — DESIGN.md §9 "hero element on investigation pages:
 * numeric center, ring around it, band label below in brackets."
 *
 * A faithful port of web/src/components/ui/TrustGauge.tsx: same dashed track
 * ("2 3"), same 3px stroke, same rotation, same provisional caveat. The web
 * version uses SVG; so does this one, via react-native-svg.
 */
import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { Mono } from "./Text";
import { StatusPill } from "./StatusPill";
import { bandForPageScore } from "../bands";
import { color, space } from "../tokens";

export function TrustGauge({
  score,
  confidence,
  size = 112,
  provisional = false,
}: {
  score: number;
  confidence?: number | null;
  size?: number;
  /**
   * True when `investigations.severity_base IS NULL` — the score came from the
   * investigator model's freehand judgment, not the deterministic scorer.
   * docs/MOBILE_APP_SPEC.md D8: "the website already renders a 'provisional'
   * caveat on the gauge when severity_base is null; the app must too."
   */
  provisional?: boolean;
}) {
  const band = bandForPageScore(score);
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <View
      style={{ alignItems: "center", gap: space.sm }}
      accessibilityRole="image"
      accessibilityLabel={
        `Trust score: ${score} out of 100, rated ${band.label}` +
        (provisional ? ". Provisional — auto-generated score, not yet verified." : "")
      }
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color.borderDefault}
              strokeWidth={3}
              fill="none"
              strokeDasharray="2 3"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={band.stroke}
              strokeWidth={3}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          </G>
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mono weight="semibold" color={band.stroke} style={{ fontSize: size * 0.32 }}>
            {score}
          </Mono>
          <Mono size="micro" tone="muted">
            /100
          </Mono>
        </View>
      </View>

      <View style={{ alignItems: "center", gap: space.xs }}>
        <StatusPill label={band.label} tone={band.tone} />
        {confidence !== undefined && confidence !== null ? (
          <Mono size="micro" tone="muted">
            {Math.round(confidence * 100)}% conf.
          </Mono>
        ) : null}
        {provisional ? <StatusPill label="Provisional" tone="neutral" /> : null}
      </View>
    </View>
  );
}
