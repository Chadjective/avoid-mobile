import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * True when the phone's "remove animations" setting is on. Starts false and
 * corrects itself after the first read, so a screen never waits on it.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (live) setReduced(on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
