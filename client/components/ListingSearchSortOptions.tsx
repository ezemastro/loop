import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import CustomButton from "./bases/CustomButton";
import { ArrowDownIcon, ArrowUpIcon } from "./Icons";
import ButtonText from "./bases/ButtonText";

export interface SortValue {
  sortBy?: SortOptions;
  sortOrder?: OrderOptions;
}
const SORT_OPTIONS = [
  { label: "Fecha", key: "createdAt" },
  { label: "Precio", key: "price" },
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
  onSortChange,
}: {
  onSortChange: (sort: SortValue) => void;
}) {
  const [sort, setSort] = useState<SortState | null>(null);
  // Skip the mount-time effect run: `sort` starts at `null`, and notifying the parent with an
  // unchanged (still-empty) sort would be a redundant call, not a real user-driven sort change.
  const isFirstRender = useRef(true);
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
        sort.sortOrder === SORT_ORDERS.DESCENDING ? SORT_ORDERS.ASCENDING : SORT_ORDERS.DESCENDING,
    });
  };
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onSortChange({
      sortBy: sort?.sortBy.key,
      sortOrder: sort?.sortOrder,
    });
    // `onSortChange` is intentionally excluded: it is recreated on every parent render (it's an
    // inline arrow function in `Search.tsx`), and this effect must only run when the user actually
    // changes `sort`, not whenever the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);
  return (
    <View className="flex-1">
      {!sort ? (
        <CustomButton onPress={nextSortOption}>
          <ButtonText>Ordenar</ButtonText>
        </CustomButton>
      ) : (
        <View className="flex-1 flex-row rounded">
          <Pressable
            onPress={nextSortOption}
            className="flex-grow justify-center items-center px-2 border border-secondary-text rounded"
          >
            <Text className="text-lg">{sort?.sortBy.label}</Text>
          </Pressable>
          <Pressable
            onPress={nextSortOrder}
            className="justify-center px-3 border border-secondary-text rounded"
          >
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
