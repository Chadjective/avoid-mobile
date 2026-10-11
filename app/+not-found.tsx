import { Link } from "expo-router";
import { Screen, Mono, Prose, space } from "@/src/design";

export default function NotFound() {
  return (
    <Screen title="Not found">
      <Mono size="heading" weight="semibold" style={{ marginBottom: space.lg }}>
        Page not found
      </Mono>
      <Link href="/" style={{ color: "#a1a1aa" }}>
        <Prose tone="secondary">Back to search</Prose>
      </Link>
    </Screen>
  );
}
