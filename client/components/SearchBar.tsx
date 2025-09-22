import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import SearchBarBase from "./bases/SearchBarBase";

export default function SearchBar({
  onChange,
  onSubmit,
  onDebounce,
  placeholder,
  className,
}: {
  onChange?: (text: string) => void;
  onSubmit?: (text: string) => void;
  onDebounce?: (text: string) => void;
  placeholder?: string;
  className?: string;
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
      className={className}
      value={value}
      handleChange={handleChange}
      onSubmit={onSubmit}
      placeholder={placeholder}
    />
  );
}
