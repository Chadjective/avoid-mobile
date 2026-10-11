import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import { color } from "@/src/design/tokens";
import { useAppFonts } from "@/src/design/fonts";
import { SessionProvider } from "@/src/session";
import { configureNotificationHandler, useNotificationTapRouting } from "@/src/notifications";

configureNotificationHandler();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    // DESIGN.md: dark by default, and the OS background must match or the
    // overscroll flashes white.
    void SystemUI.setBackgroundColorAsync(color.bgBase);
  }, []);

  const ready = fontsLoaded || !!fontError;
  useNotificationTapRouting(ready);

  // A font failure falls through to the system faces rather than blocking the
  // app (see src/design/fonts.ts) — but it never blocks forever.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bgBase, justifyContent: "center" }}>
        <ActivityIndicator color={color.textMuted} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bgBase },
            animation: "fade",
          }}
        />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
