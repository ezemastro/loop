import React from "react";
import { View } from "react-native";
import { twMerge } from "tailwind-merge";
import type { Breakpoint } from "@/hooks/useBreakpoint";

/**
 * Grid gutter mechanism (design.md D2): the row carries a negative horizontal margin and every
 * cell carries the matching positive padding, so each cell is exactly `w-1/N` of the padded row.
 * `gap-*` + `w-1/N` is rejected — combined with percentage widths it overflows a flex-wrap row and
 * collapses it to one item per line. Callers must already have >=6px horizontal padding (all do).
 */
export const GRID_ROW_CLASS = "flex-row flex-wrap -mx-1.5";
export const GRID_CELL_CLASS = "w-full shrink-0 grow-0 md:w-1/2 lg:w-1/3 xl:w-1/4 px-1.5 pb-3";

/** Column count per breakpoint — the single source for the 1/2/3/4 ramp asserted by tests. */
export const columnsAt = (bp: Breakpoint): number => ({ base: 1, md: 2, lg: 3, xl: 4 })[bp];

/**
 * Wraps every child in a `GRID_CELL_CLASS` cell. Used by `.map()` callers (`Feed`,
 * `ListingViewList`); `Search.tsx` keeps its `FlatList` and imports the two class constants
 * directly instead (design.md D2) so the column ramp exists in exactly one string.
 */
export default function ListingGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={twMerge(GRID_ROW_CLASS, className)}>
      {React.Children.map(children, (child) => (
        <View className={GRID_CELL_CLASS}>{child}</View>
      ))}
    </View>
  );
}
