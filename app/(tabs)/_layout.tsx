import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, fontFamily, layout, tracking } from "@/src/design";
import { TabIcon, type TabIconName } from "@/src/design/tab-icons";

const icon = (name: TabIconName) => ({ color }: { color: ColorValue }) => (
  <TabIcon name={name} color={color} />
);

/**
 * Five tabs: a thin outline icon over a mono uppercase label. The icons are
 * five small react-native-svg drawings (src/design/tab-icons.tsx), so there is
 * still no icon font in the bundle. 0.2.4 shipped words only; on a phone the
 * row was hard to tell apart at a glance.
 */
export default function TabsLayout() {
  // Edge-to-edge Android draws behind the 3-button / gesture bar, so the bar
  // grows by that inset instead of letting the labels sit under it.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      // Back returns to the previously focused route: the tab (or the page
      // opened from it) the user came from, not always the first tab.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.bgBase },
        tabBarStyle: {
          backgroundColor: color.bgBase,
          borderTopWidth: 1,
          borderTopColor: color.borderMuted,
          height: layout.tabBarHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
        // Standard Android behaviour: the keyboard takes the bottom of the
        // screen and the tab bar goes with it, rather than floating above
        // the keys. It also hands the scene those 56px, which is where the
        // focused field's submit button ends up.
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: fontFamily.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: tracking.label,
        },
        tabBarActiveTintColor: color.textPrimary,
        tabBarInactiveTintColor: color.textMuted,
        tabBarItemStyle: { paddingTop: 6, paddingBottom: 4 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Search", tabBarIcon: icon("search") }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: icon("scan") }} />
      <Tabs.Screen name="watchlist" options={{ title: "Watch", tabBarIcon: icon("watch") }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: icon("alerts") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("profile") }} />
      {/*
        Pages opened from a tab. Hidden from the bar (href: null) but inside
        the navigator, so the bar stays visible on them and the URLs are
        unchanged: (tabs) is a group, so these are still /entity/<slug>,
        /entity/<slug>/submit and /request/<id>. No tab is highlighted while
        one is open.
      */}
      <Tabs.Screen name="entity/[slug]" options={{ href: null }} />
      <Tabs.Screen name="entity/[slug]/submit" options={{ href: null }} />
      <Tabs.Screen name="request/[id]" options={{ href: null }} />
      {/* Opened from the Watch header's [+]: search, Follow, or request a page. */}
      <Tabs.Screen name="watch-add" options={{ href: null }} />
    </Tabs>
  );
}
