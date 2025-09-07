import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import CustomButton from "./bases/CustomButton";
import { ArrowDownIcon, ArrowUpIcon } from "./Icons";
import { useDebouncedCallback } from "use-debounce";

export interface SortValue {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
const SORT_OPTIONS = [
  { label: "Fecha", key: "createdAt" },
  { label: "Precio", key: "price_credits" },
] as const;
const SORT_ORDERS = {
  ASCENDING: "asc",
  DESCENDING: "desc",
} as const;

interface SortState {
  sortBy: (typeof SORT_OPTIONS)[number];
  sortOrder: (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS];
}
export default function ListingSearchSortOptions({
  onDebounce,
}: {
  onDebounce: (sort: SortValue) => void;
}) {
  const [sort, setSort] = useState<SortState | null>(null);
  const nextSortOption = () => {
    if (sort === null) {
      return setSort({
        sortBy: SORT_OPTIONS[0],
        sortOrder: SORT_ORDERS.DESCENDING,
      });
    }
    if (sort.sortBy === SORT_OPTIONS[SORT_OPTIONS.length - 1]) {
      return setSort(null);
    }
    setSort({
      sortBy: SORT_OPTIONS[SORT_OPTIONS.indexOf(sort.sortBy) + 1],
      sortOrder: sort.sortOrder,
    });
  };
  const nextSortOrder = () => {
    if (!sort) return;
    setSort({
      sortBy: sort.sortBy,
      sortOrder:
        sort.sortOrder === SORT_ORDERS.DESCENDING
          ? SORT_ORDERS.ASCENDING
          : SORT_ORDERS.DESCENDING,
    });
  };
  const debouncedSort = useDebouncedCallback((newSort: SortState | null) => {
    onDebounce({
      sortBy: newSort?.sortBy.key,
      sortOrder: newSort?.sortOrder,
    });
  }, 500);
  useEffect(() => {
    debouncedSort(sort);
  }, [sort, debouncedSort]);
  return (
    <View className="flex-1">
      {!sort ? (
        <CustomButton onPress={nextSortOption} className="bg-secondary">
          <Text>Ordenar</Text>
        </CustomButton>
      ) : (
        <View className="flex-1 flex-row border border-main-text rounded px-2">
          <Pressable
            onPress={nextSortOption}
            className="flex-grow justify-center items-center px-2"
          >
            <Text className="text-lg">{sort?.sortBy.label}</Text>
          </Pressable>
          <Pressable onPress={nextSortOrder} className="justify-center px-2">
            {sort?.sortOrder === SORT_ORDERS.ASCENDING ? (
              <ArrowUpIcon className="text-main-text" />
            ) : (
              <ArrowDownIcon className="text-main-text" />
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
