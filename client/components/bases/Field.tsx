import { forwardRef, useState, type ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from "react-native";
import { twMerge } from "tailwind-merge";
import { useThemeColors } from "@/hooks/useThemeColors";
import { ArrowDownIcon, EyeIcon, EyeOffIcon } from "../Icons";
import { fieldWrapperProps } from "./fieldProps";

type ControlState = { invalid?: boolean; disabled?: boolean; multiline?: boolean };

/**
 * The one look for every text input and every control that opens a selection: 44px tall (96 for
 * multiline), white, 1px stroke, `rounded-lg`, 12px of side padding. A disabled control swaps the
 * white for the page background and loses the border colour, so it never reads as editable.
 */
export const controlClassName = ({ invalid, disabled, multiline }: ControlState = {}) =>
  twMerge(
    "flex-row items-center gap-2 rounded-lg border px-3",
    multiline ? "min-h-[96px] items-start" : "min-h-[44px]",
    disabled ? "bg-background border-transparent" : "bg-white",
    !disabled && (invalid ? "border-alert" : "border-stroke"),
  );

const TEXT_CLASS = "text-base text-main-text";

/** Label above, control in the middle, helper or error below. */
export function Field({
  label,
  helper,
  error,
  children,
  className,
}: {
  label?: string;
  helper?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={twMerge("gap-1", className)}>
      {label ? <Text className="text-sm font-medium text-main-text">{label}</Text> : null}
      {children}
      {error ? (
        <Text className="text-sm text-alert" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text className="text-xs text-secondary-text">{helper}</Text>
      ) : null}
    </View>
  );
}

export type TextFieldProps = TextInputProps & {
  invalid?: boolean;
  /** Adornment before the text (currency icon, ...). */
  leading?: ReactNode;
  /** Adornment after the text (password eye, ...). */
  trailing?: ReactNode;
  /** Classes for the bordered wrapper. `className` goes to the inner `TextInput`. */
  wrapperClassName?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { invalid, leading, trailing, wrapperClassName, className, editable = true, multiline, ...props },
  ref,
) {
  const colors = useThemeColors();
  return (
    <View
      {...fieldWrapperProps}
      className={twMerge(
        controlClassName({ invalid, disabled: !editable, multiline }),
        wrapperClassName,
      )}
    >
      {leading}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.SECONDARY_TEXT}
        editable={editable}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        {...props}
        className={twMerge(
          "flex-1 py-2.5 text-left",
          TEXT_CLASS,
          multiline ? "min-h-[88px]" : "",
          !editable ? "text-secondary-text" : "",
          className,
        )}
      />
      {trailing}
    </View>
  );
});

/** `TextField` for passwords, with the show/hide eye as its trailing adornment. */
export const PasswordField = forwardRef<TextInput, Omit<TextFieldProps, "secureTextEntry">>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        ref={ref}
        secureTextEntry={!visible}
        trailing={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="-mr-1 h-9 w-9 items-center justify-center"
          >
            {visible ? (
              <EyeOffIcon size={20} className="text-secondary-text" />
            ) : (
              <EyeIcon size={20} className="text-secondary-text" />
            )}
          </Pressable>
        }
      />
    );
  },
);

/**
 * A control that opens a selection (modal list, picker). Shows `value` in main text or
 * `placeholder` in the placeholder colour, left aligned, with a chevron on the right.
 */
export function ControlTrigger({
  value,
  placeholder,
  children,
  leading,
  trailing,
  invalid,
  disabled,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  /** Text for the current selection. Ignored when `children` is given. */
  value?: string | null;
  placeholder?: string;
  /** Custom content for the selection (e.g. several lines). */
  children?: ReactNode;
  leading?: ReactNode;
  /** Replaces the default chevron. */
  trailing?: ReactNode;
  invalid?: boolean;
  className?: string;
}) {
  const hasValue = !!children || !!value;
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      className={twMerge(
        controlClassName({ invalid, disabled: !!disabled }),
        "web:cursor-pointer",
        disabled ? "web:cursor-default" : "hover:bg-background/60 active:opacity-80",
        className,
      )}
    >
      {leading}
      <View className="flex-1 justify-center py-2.5">
        {children ?? (
          <Text
            numberOfLines={1}
            className={twMerge(
              "text-left text-base",
              hasValue && !disabled ? "text-main-text" : "text-secondary-text",
            )}
          >
            {hasValue ? value : placeholder}
          </Text>
        )}
      </View>
      {trailing ?? <ArrowDownIcon size={20} className="text-secondary-text" />}
    </Pressable>
  );
}
