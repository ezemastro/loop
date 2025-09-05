import { useSearchStore } from "@/stores/search";
import SearchBarBase from "../bases/SearchBarBase";
import { Pressable } from "react-native";

export default function HeaderSearchBar({
  onNavigate,
  isSearchScreen,
}: {
  onNavigate: () => void;
  isSearchScreen: boolean;
}) {
  const { query, setQuery } = useSearchStore();
  if (!isSearchScreen) {
    return (
      <Pressable onPress={onNavigate}>
        <SearchBarBase
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
      value={query}
      handleChange={setQuery}
      onSubmit={() => {}}
      placeholder="Buscar artículos escolares..."
      autoFocus={isSearchScreen}
    />
  );
}
