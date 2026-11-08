import { useSearchStore } from "@/stores/search";
import SearchBarBase from "../bases/SearchBarBase";
import { Pressable } from "react-native";

export default function HeaderSearchBar({
  onNavigate,
  isSearchScreen,
  className,
}: {
  onNavigate: () => void;
  isSearchScreen: boolean;
  className?: string;
}) {
  const { query, setQuery } = useSearchStore();
  if (!isSearchScreen) {
    return (
      <Pressable accessibilityRole="search" onPress={onNavigate}>
        <SearchBarBase
          className={className}
          value={query}
          handleChange={() => {}}
          placeholder="Buscar artículos escolares..."
          disabled
        />
      </Pressable>
    );
  }

  return (
    <SearchBarBase
      className={className}
      value={query}
      handleChange={setQuery}
      onSubmit={() => {}}
      placeholder="Buscar artículos escolares..."
      autoFocus={isSearchScreen}
    />
  );
}
