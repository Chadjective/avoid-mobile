/**
 * Tab bar icons — five outline glyphs drawn with react-native-svg (already a
 * dependency), so no icon font ships for them. One 24-unit grid, round caps,
 * and `currentColor`-style tinting through the `color` the tab bar passes in,
 * so active/inactive follow the tab bar's tint colours.
 */
import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type TabIconName = "search" | "scan" | "watch" | "alerts" | "profile";

export function TabIcon({
  name,
  color,
  size = 22,
}: {
  name: TabIconName;
  color: ColorValue;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "search" ? (
        <>
          <Circle cx={11} cy={11} r={6.5} />
          <Path d="M16 16l4.5 4.5" />
        </>
      ) : null}
      {name === "scan" ? (
        // Wallet: body, flap line and the clasp.
        <>
          <Path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2" />
          <Path d="M4 7.5V17a2 2 0 0 0 2 2h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z" />
          <Circle cx={15.5} cy={13.5} r={1} />
        </>
      ) : null}
      {name === "watch" ? (
        <>
          <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <Circle cx={12} cy={12} r={2.75} />
        </>
      ) : null}
      {name === "alerts" ? (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5z" />
          <Path d="M10 20.5a2 2 0 0 0 4 0" />
        </>
      ) : null}
      {name === "profile" ? (
        <>
          <Circle cx={12} cy={8} r={3.75} />
          <Path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
        </>
      ) : null}
    </Svg>
  );
}

/**
 * Shield outline for Profile's Wallet Guardian row. Same grid and stroke as the
 * tab icons so the two read as one set.
 */
export function ShieldIcon({ color, size = 22 }: { color: ColorValue; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 3l7.5 3v5.5c0 4.4-3.1 7.9-7.5 9.5-4.4-1.6-7.5-5.1-7.5-9.5V6L12 3z" />
    </Svg>
  );
}
