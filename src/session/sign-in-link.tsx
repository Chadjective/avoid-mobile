/**
 * The words "sign in", wherever they are offered to a signed-out user, as a
 * thing you can tap.
 *
 * Owner request from the first device test (2026-09-18): every screen said
 * "Sign in on the Profile tab" as flat prose, so the instruction was to go
 * find a tab. This renders inside a <Prose> run — a nested React Native <Text>
 * with an `onPress`, not a Pressable, so it stays on the same line as the
 * sentence around it — and routes to the Profile tab, which is the one place
 * sign-in lives.
 *
 * It is never rendered while a session exists. That is the calling screen's
 * job, and `useSession().signedIn` is the only test for it.
 */
import { useRouter } from "expo-router";
import { Prose } from "../design";
import { color } from "../design";

export function SignInLink({ label = "Sign in" }: { label?: string }) {
  const router = useRouter();
  return (
    <Prose
      accessibilityRole="link"
      accessibilityHint="Opens the Profile tab, where you can sign in"
      onPress={() => router.push("/profile")}
      color={color.textPrimary}
      style={{ textDecorationLine: "underline" }}
    >
      {label}
    </Prose>
  );
}
