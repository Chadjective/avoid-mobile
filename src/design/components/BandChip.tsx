/**
 * The score + band chip used in list rows (search results, watchlist, scan
 * holdings). Uses the same four-band scale and labels as the page gauge
 * (CRITICAL / WARNING / CAUTIONARY / LOW RISK).
 */
import { View } from "react-native";
import { Mono } from "./Text";
import { bandForPageScore } from "../bands";
import { border, color, radius, space } from "../tokens";

export function BandChip({ score }: { score: number | null | undefined }) {
  const valid = typeof score === "number" && Number.isFinite(score);
  const band = valid ? bandForPageScore(score) : null;

  if (!band) {
    return (
      <View style={chipStyle(color.borderMuted)}>
        <Mono size="micro" label tone="muted">
          no score
        </Mono>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <Mono size="body" weight="medium" color={band.stroke}>
        {Math.round(score as number)}
      </Mono>
      <View style={chipStyle(band.stroke)}>
        <Mono size="micro" label color={band.stroke}>
          {band.label}
        </Mono>
      </View>
    </View>
  );
}

function chipStyle(borderColor: string) {
  return {
    borderWidth: border.width,
    borderStyle: border.style,
    borderColor,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  } as const;
}
