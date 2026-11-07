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
  // Same 36px height, radius and border as the `secondary` `sm` buttons it sits next to, so the
  // row does not jump when the control switches between its closed and open states.
  return !sort ? (
    <CustomButton
      variant="secondary"
      size="sm"
      onPress={nextSortOption}
      className="w-auto max-w-none"
    >
      <ButtonText>Ordenar</ButtonText>
    </CustomButton>
  ) : (
    <View className="min-h-[36px] flex-row items-stretch overflow-hidden rounded-lg border border-stroke bg-white">
      <Pressable
        accessibilityRole="button"
        onPress={nextSortOption}
        className="justify-center px-3 hover:bg-background active:opacity-80"
      >
        <Text className="text-sm font-semibold text-main-text">{sort.sortBy.label}</Text>
      </Pressable>
      <View className="w-px bg-stroke" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          sort.sortOrder === SORT_ORDERS.ASCENDING ? "Orden ascendente" : "Orden descendente"
        }
        onPress={nextSortOrder}
        className="justify-center px-2 hover:bg-background active:opacity-80"
      >
        {sort.sortOrder === SORT_ORDERS.ASCENDING ? (
          <ArrowUpIcon size={18} className="text-main-text" />
        ) : (
          <ArrowDownIcon size={18} className="text-main-text" />
        )}
      </Pressable>
    </View>
  );
}
