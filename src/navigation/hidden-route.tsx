import { Fragment, type ReactNode } from "react";
import { useIsFocused } from "expo-router";

/**
 * The entity and request screens are hidden tab routes (`href: null` in
 * app/(tabs)/_layout.tsx) so the tab bar stays visible on them. A tab
 * navigator keeps every visited screen mounted, unlike a stack, which would
 * leave a closed page's state, its form draft and the request poll alive in
 * the background and show the previous page's content for a frame when the
 * next one opens. This mounts the screen only while it is focused, and the
 * `id` (the slug or request id) makes a different page a fresh mount.
 */
export function WhileFocused({ id, children }: { id: string | undefined; children: ReactNode }) {
  const focused = useIsFocused();
  if (!focused) return null;
  return <Fragment key={id ?? ""}>{children}</Fragment>;
}

/** The "← back" action: back when there is history, else the Search tab. */
export function goBack(router: { canGoBack(): boolean; back(): void; replace(href: "/"): void }) {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
