import { View, TextInput, Pressable } from "react-native";
import { SearchIcon } from "../Icons";
import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { twMerge } from "tailwind-merge";
import { fieldWrapperProps } from "./fieldProps";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function SearchBarBase({
  value,
  handleChange,
  onSubmit,
  placeholder,
  autoFocus,
  disabled,
  className,
}: {
  value: string;
  handleChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const colors = useThemeColors();
  const inputRef = useRef<TextInput>(null);
  // TODO - Arreglar esto, el ref es siempre null
  useFocusEffect(
    useCallback(() => {
      if (autoFocus && inputRef.current) {
        const timeout = setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timeout);
      }
    }, [autoFocus]),
  );
  return (
    <View
      {...fieldWrapperProps}
      className={twMerge(
        "min-h-[44px] flex-row items-center border border-stroke bg-white rounded-lg px-2",
        className,
      )}
    >
      <TextInput
        placeholderTextColor={colors.SECONDARY_TEXT}
        ref={inputRef}
        placeholder={placeholder || "Buscar..."}
        className="flex-1 px-2 py-2 text-base text-main-text"
        onChangeText={handleChange}
        onSubmitEditing={() => onSubmit?.(value)}
        value={value}
        editable={!disabled}
        pointerEvents={disabled ? "none" : "auto"}
      />
      <Pressable
        className="flex items-center justify-center px-2"
        pointerEvents={disabled ? "none" : "auto"}
        onPress={() => {
          onSubmit?.(value);
        }}
      >
        <SearchIcon size={20} className="text-secondary-text" />
      </Pressable>
    </View>
  );
}
