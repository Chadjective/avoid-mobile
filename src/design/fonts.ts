/**
 * Type system, DESIGN.md §7: Geist Mono for data, Geist Sans for prose.
 * "Do not use Arial or system-ui anywhere."
 *
 * @expo-google-fonts/geist and @expo-google-fonts/geist-mono ship the same
 * families the web app loads through next/font, so the two surfaces render the
 * same letterforms. If loading fails (offline first run, a stripped build) the
 * app falls back to the platform mono/sans rather than rendering nothing —
 * that fallback is a degraded state, not the design.
 */
import { useFonts } from "expo-font";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
} from "@expo-google-fonts/geist-mono";
import { Platform } from "react-native";

export const fontFamily = {
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
  monoSemiBold: "GeistMono_600SemiBold",
  sans: "Geist_400Regular",
  sansMedium: "Geist_500Medium",
  sansSemiBold: "Geist_600SemiBold",
} as const;

/**
 * TODO(mobile): these are the fallbacks used until `useAppFonts()` resolves,
 * and permanently if the font load errors. Android's system mono is Roboto
 * Mono, which is not Geist Mono; a shipped build should never sit here.
 */
export const fallbackFontFamily = {
  mono: Platform.select({ android: "monospace", default: "monospace" }) as string,
  sans: Platform.select({ android: "sans-serif", default: "System" }) as string,
};

/** Load the brand faces. Returns [loaded, error] like expo-font's hook. */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });
}
