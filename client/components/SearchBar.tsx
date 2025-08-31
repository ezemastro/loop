import { View, TextInput, Pressable } from "react-native";
import { SearchIcon } from "./Icons";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export default function SearchBar({
  onChange,
  onSubmit,
  onDebounce,
}: {
  onChange?: (text: string) => void;
  onSubmit?: (text: string) => void;
  onDebounce?: (text: string) => void;
}) {
  const [value, setValue] = useState<string>("");

  const debounced = useDebouncedCallback((text: string) => {
    onDebounce?.(text);
  }, 300);

  const handleChange = (text: string) => {
    setValue(text);
    debounced(text);
    onChange?.(text);
  };
  return (
    <View className="flex-row border border-stroke rounded-full px-2">
      <TextInput
        placeholder="Buscar..."
        className="flex-1 px-2"
        onChangeText={handleChange}
        onSubmitEditing={() => onSubmit?.(value)}
        value={value}
      />
      <Pressable
        className="flex items-center justify-center px-2"
        onPress={() => onSubmit?.(value)}
      >
        <SearchIcon className="color-main-text" />
      </Pressable>
    </View>
  );
}
