import { View, TextInput, Pressable } from "react-native";
import { SearchIcon } from "../Icons";
import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { twMerge } from "tailwind-merge";

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
  const inputRef = useRef<TextInput>(null);
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
      className={twMerge(
        "flex-row border border-stroke bg-background rounded-full px-2",
        className,
      )}
    >
      <TextInput
        placeholder={placeholder || "Buscar..."}
        className="flex-1 px-2"
        onChangeText={handleChange}
        onSubmitEditing={() => onSubmit?.(value)}
        value={value}
        ref={inputRef}
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
        <SearchIcon className="color-main-text" />
      </Pressable>
    </View>
  );
}
