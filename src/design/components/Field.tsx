/** A dashed-border text input, in the same idiom as the buttons. */
import { useCallback } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { border, color, radius, space } from "../tokens";
import { fontFamily } from "../fonts";
import { useRevealFocusedInput } from "./Screen";

export function Field(props: TextInputProps) {
  const revealFocusedInput = useRevealFocusedInput();
  const { onFocus } = props;

  /**
   * Taking focus opens the keyboard over the bottom of the page, and the
   * button that submits this field is usually right under it. Screen scrolls
   * both back into view; moving between fields with the keyboard already open
   * fires no keyboard event, so the focus itself has to ask.
   */
  const handleFocus = useCallback(
    (event: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      revealFocusedInput();
      onFocus?.(event);
    },
    [onFocus, revealFocusedInput],
  );

  return (
    <TextInput
      placeholderTextColor={color.textMuted}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      onFocus={handleFocus}
      style={[
        {
          borderWidth: border.width,
          borderStyle: border.style,
          borderColor: color.borderDefault,
          borderRadius: radius.card,
          paddingHorizontal: space.md,
          paddingVertical: space.md,
          color: color.textPrimary,
          fontFamily: fontFamily.mono,
          fontSize: 15,
        },
        props.style,
      ]}
    />
  );
}
