import { Linking, Pressable, type ViewStyle } from "react-native";
import { color } from "../tokens";
import { Mono } from "./Text";

/**
 * "See the queue →" — the link every request action ends with. Pass
 * `onPress` to open an app screen, or `url` to open the website. Cyan, like the
 * app's other "go and look" links.
 */
export function QueueLink({
  label = "See the queue →",
  onPress,
  url,
  style,
}: {
  label?: string;
  onPress?: () => void;
  url?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={() => (onPress ? onPress() : url ? void Linking.openURL(url) : undefined)}
      accessibilityRole="link"
      accessibilityLabel={label.replace("→", "").trim()}
      hitSlop={8}
      style={[{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }, style]}
    >
      <Mono size="label" label color={color.accentAnchor}>
        {label}
      </Mono>
    </Pressable>
  );
}
