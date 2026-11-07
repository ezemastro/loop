import { useMemo } from "react";
import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";
import { twMerge } from "tailwind-merge";
import { useThemeColors } from "@/hooks/useThemeColors";
import { ButtonContext } from "./ButtonContext";
import {
  SIZE_CONTAINER,
  VARIANT_CONTAINER,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

export type CustomButtonProps = Omit<PressableProps, "children"> & {
  children: React.ReactNode;
  /** Visual weight. One `primary` per view; `secondary` for Cancelar / Volver. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Replaces the content with a spinner, keeps the width and blocks presses. */
  loading?: boolean;
  className?: string;
};

export default function CustomButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  ...props
}: CustomButtonProps) {
  const colors = useThemeColors();
  const context = useMemo(() => ({ variant, size }), [variant, size]);
  const isInert = !!disabled || loading;
  const spinnerColor =
    variant === "primary" || variant === "danger"
      ? "#fff"
      : variant === "dangerGhost"
        ? colors.ALERT
        : colors.MAIN_TEXT;

  return (
    <ButtonContext.Provider value={context}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isInert, busy: loading }}
        {...props}
        disabled={isInert}
        className={twMerge(
          // A standalone action button is capped and centred: the page column is up to 1400px wide
          // and a button that wide reads as an accident, not a decision. Buttons that are meant to
          // fill a `flex-row` bar opt out with `w-auto max-w-none` at their call site: without
          // `w-auto` the inherited `w-full` makes every sibling demand 100% of the row and the last
          // one collapses to a sliver.
          "rounded-lg self-center w-full max-w-md items-center justify-center web:cursor-pointer",
          SIZE_CONTAINER[size],
          VARIANT_CONTAINER[variant],
          isInert ? "opacity-50 web:cursor-default" : "",
          className,
        )}
      >
        {/* The content stays laid out (invisible) while loading so the button keeps its width. */}
        <View
          className={twMerge("flex-row items-center justify-center gap-2", loading && "opacity-0")}
        >
          {children}
        </View>
        {loading ? (
          <View className="absolute inset-0 items-center justify-center">
            <ActivityIndicator size="small" color={spinnerColor} />
          </View>
        ) : null}
      </Pressable>
    </ButtonContext.Provider>
  );
}
