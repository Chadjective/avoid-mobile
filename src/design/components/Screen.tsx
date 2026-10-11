/**
 * Page chrome: the dark base, the faint dot grid from DESIGN.md §6
 * ("subtle grid background, ~5% opacity"), a safe-area inset — and the
 * keyboard handling every screen with a text field relies on.
 *
 * Why the keyboard needs code at all. Expo SDK 54+ forces edge-to-edge on
 * Android, and Android 15 forces it on anything targeting API 35, so the
 * window is laid out behind the system bars and `adjustResize` no longer
 * resizes it when the IME opens: the keyboard arrives as a window inset over
 * a page that is still full height, covering whatever is at the bottom.
 * `app.json` still declares `android.softwareKeyboardLayoutMode: "resize"`
 * (it is the Expo default, but this file depends on it, so it is written
 * down) for any build or device where the window does still resize — the
 * measurement below notices that case and stands down rather than moving the
 * page twice.
 *
 * So the resize is done here:
 *
 * 1. `keyboardDidShow` carries a height React Native derives from the IME
 *    inset itself (`ReactRootView.checkForKeyboardEvents`: ime.bottom minus
 *    systemBars.bottom), which is dependable under edge-to-edge. The frame
 *    takes that plus the bottom safe-area inset as bottom padding, because
 *    the IME covers the navigation bar too. The ScrollView viewport then
 *    shrinks exactly the way a resizing window used to shrink it.
 * 2. A shrinking viewport makes the native ScrollView pull its focused child
 *    back into view, but "into view" is the field alone — the button under it
 *    can stay hidden. `reveal()` scrolls far enough to keep REVEAL_BELOW_FIELD
 *    of page below the field on screen, which is where that button is.
 *    `Field` calls it on focus (through `useRevealFocusedInput`), so it also
 *    works when the user moves between fields with the keyboard already up,
 *    which fires no keyboard event.
 *
 * `KeyboardAvoidingView` covers (1) only, and does it off
 * `getWindowVisibleDisplayFrame` (the keyboard event's `screenY`) rather than
 * off the inset, so this file does not use it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Keyboard,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mono } from "./Text";
import { color, layout, space } from "../tokens";

/**
 * Page kept on screen below a focused field: a Button (a 15px label with
 * 12px of padding above and below) and the gap over it, so the control that
 * submits the field is visible with it.
 */
const REVEAL_BELOW_FIELD = 64;

/**
 * The reveal has to run after the frame has re-laid-out around the keyboard.
 * One frame is not always enough for a cold keyboard, so this waits out the
 * IME animation instead of racing it.
 */
const REVEAL_DELAY_MS = 80;

/**
 * Screen hands its children a way to say "I am focused — keep me and my
 * button on screen". `Field` is the only caller; anything rendering a bare
 * TextInput should call it from `onFocus` too.
 */
const RevealFocusedInputContext = createContext<() => void>(() => {});

export function useRevealFocusedInput(): () => void {
  return useContext(RevealFocusedInputContext);
}

/** A 1px dot every 24px, drawn with plain Views — no image asset needed. */
function DotGrid({ rows = 40, cols = 20 }: { rows?: number; cols?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: "row", height: 24 }}>
          {Array.from({ length: cols }).map((__, c) => (
            <View
              key={c}
              style={{ width: 24, alignItems: "flex-start", justifyContent: "flex-start" }}
            >
              <View style={{ width: 1, height: 1, backgroundColor: color.bgGrid }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Screen({
  children,
  title,
  scroll = true,
  contentStyle,
  refreshControl,
  scrollRef: externalScrollRef,
  footer,
}: {
  children: ReactNode;
  title?: string;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /**
   * Pull-to-refresh for a scrolling screen. The app polls nothing on a timer
   * (every request is a billed invocation), so a pull is how a user asks for
   * fresh data. Ignored when `scroll` is false — there is nothing to pull.
   */
  refreshControl?: ScrollViewProps["refreshControl"];
  /** Lets a screen scroll itself (the page's contents list jumps to a section). */
  scrollRef?: RefObject<ScrollView | null>;
  /**
   * A control pinned above the tab bar, outside the scrolling content, so the
   * main action sits where the thumb is (and where the wallet's own sheet
   * opens). It is hidden while the keyboard is open: a pinned bar would sit on
   * top of the keyboard and eat the viewport that the focused field needs.
   */
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [keyboardInset, setKeyboardInset] = useState(0);

  const ownScrollRef = useRef<ScrollView>(null);
  const scrollRef = externalScrollRef ?? ownScrollRef;
  const innerRef = useRef<View>(null);
  const keyboardHeight = useRef(0);
  /** Current height of the frame, and the tallest it has been. */
  const frameHeight = useRef(0);
  const unobstructedFrameHeight = useRef(0);
  const viewportHeight = useRef(0);
  const scrollOffset = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * How much of the frame the keyboard covers. `shrunkBy` is the belt and
   * braces: if the OS did resize the window (a build or a device where
   * `adjustResize` still bites), the frame is already shorter than its
   * unobstructed height and that much of the keyboard is already accounted
   * for — padding by the full height on top of it would move the page twice.
   */
  const applyKeyboardInset = useCallback(() => {
    if (keyboardHeight.current <= 0) {
      setKeyboardInset(0);
      return;
    }
    const shrunkBy = Math.max(0, unobstructedFrameHeight.current - frameHeight.current);
    setKeyboardInset(Math.max(0, keyboardHeight.current + insets.bottom - shrunkBy));
  }, [insets.bottom]);

  const reveal = useCallback(() => {
    const scrollView = scrollRef.current;
    const inner = innerRef.current;
    const input = TextInput.State.currentlyFocusedInput();
    const viewport = viewportHeight.current;
    if (!scrollView || !inner || !input || viewport <= 0) return;

    input.measureLayout(
      inner,
      (_x, y, _width, height) => {
        const top = scrollOffset.current;
        const wantedBottom = y + height + REVEAL_BELOW_FIELD;
        if (wantedBottom > top + viewport) {
          scrollView.scrollTo({ y: Math.max(0, wantedBottom - viewport), animated: true });
        } else if (y < top) {
          scrollView.scrollTo({ y: Math.max(0, y - space.md), animated: true });
        }
      },
      () => {
        // The field went away between focus and measure; nothing to reveal.
      },
    );
  }, []);

  const scheduleReveal = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      revealTimer.current = null;
      reveal();
    }, REVEAL_DELAY_MS);
  }, [reveal]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardHeight.current = event.endCoordinates.height;
      applyKeyboardInset();
      scheduleReveal();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardHeight.current = 0;
      applyKeyboardInset();
    });
    return () => {
      show.remove();
      hide.remove();
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [applyKeyboardInset, scheduleReveal]);

  const onFrameLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height === frameHeight.current) return;
      frameHeight.current = height;
      if (height > unobstructedFrameHeight.current) unobstructedFrameHeight.current = height;
      applyKeyboardInset();
    },
    [applyKeyboardInset],
  );

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
  }, []);

  const padding: ViewStyle = {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    /**
     * Inside the tabs (now including the entity and request pages) the scene
     * stops at the tab bar, which already clears the navigation bar; only
     * auth and not-found run behind it. The taller of the two is the dead
     * strip the last control has to clear either way (unchanged: a fixed
     * 64 of slack under the content, independent of the bar's new inset).
     */
    paddingBottom: (footer ? 0 : Math.max(insets.bottom, layout.tabBarHeight)) + space.lg,
  };
  const showFooter = footer != null && keyboardInset === 0;

  const header = title ? (
    <Mono size="label" label tone="secondary" style={{ marginBottom: space.lg }}>
      {title}
    </Mono>
  ) : null;

  return (
    <View
      onLayout={onFrameLayout}
      style={{
        flex: 1,
        backgroundColor: color.bgBase,
        paddingTop: insets.top,
        paddingBottom: keyboardInset,
      }}
    >
      <DotGrid />
      <RevealFocusedInputContext.Provider value={scheduleReveal}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            // The cast is the React 19 types: a `useRef<View>(null)` is a
            // `RefObject<View | null>` and this prop still asks for the
            // non-null form. React fills it in on mount either way.
            innerViewRef={innerRef as RefObject<View>}
            contentContainerStyle={[padding, contentStyle]}
            // A tap on "Send link" with the keyboard open has to press the
            // button, not be swallowed dismissing the keyboard.
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onLayout={onViewportLayout}
            onScroll={onScroll}
            scrollEventThrottle={32}
            refreshControl={refreshControl}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, padding, contentStyle]}>
            {header}
            {children}
          </View>
        )}
      </RevealFocusedInputContext.Provider>
      {showFooter ? (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: space.md,
            borderTopWidth: 1,
            borderTopColor: color.borderMuted,
            backgroundColor: color.bgBase,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
