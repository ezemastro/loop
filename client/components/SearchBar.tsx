import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import SearchBarBase from "./bases/SearchBarBase";

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
    <SearchBarBase
      value={value}
      handleChange={handleChange}
      onSubmit={onSubmit}
    />
  );
}
