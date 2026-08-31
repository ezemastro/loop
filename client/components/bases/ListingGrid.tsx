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

/** Column count per breakpoint. Only the breakpoints present in the ramp get a width class. */
export type ColumnRamp = Partial<Record<Breakpoint, number>>;

/** Default listing ramp — 1/2/3/4 columns at base/md/lg/xl. */
export const LISTING_COLUMN_RAMP: ColumnRamp = { base: 1, md: 2, lg: 3, xl: 4 };

const BREAKPOINT_PREFIX: Record<Breakpoint, string> = {
  base: "",
  md: "md:",
  lg: "lg:",
  xl: "xl:",
};
const BREAKPOINT_ORDER: Breakpoint[] = ["base", "md", "lg", "xl"];

const fractionClass = (columns: number) => (columns <= 1 ? "w-full" : `w-1/${columns}`);

/**
 * Builds the width-fraction classes for a column ramp, e.g. `{ base: 1, md: 2 }` ->
 * `"w-full md:w-1/2"`, plus the shared cell padding/shrink tokens.
 */
export const gridCellClass = (ramp: ColumnRamp): string =>
  twMerge(
    "shrink-0 grow-0 px-1.5 pb-3",
    BREAKPOINT_ORDER.filter((bp) => ramp[bp] !== undefined)
      .map((bp) => `${BREAKPOINT_PREFIX[bp]}${fractionClass(ramp[bp]!)}`)
      .join(" "),
  );

/** Column count per breakpoint for the default listing ramp — the 1/2/3/4 ramp asserted by tests. */
export const columnsAt = (bp: Breakpoint): number => LISTING_COLUMN_RAMP[bp] ?? 1;

/** Default cell class — kept as an eagerly-built constant so `GRID_CELL_CLASS` stays a plain string. */
export const GRID_CELL_CLASS = gridCellClass(LISTING_COLUMN_RAMP);

/**
 * Wraps every child in a column-ramp cell. Used by `.map()` callers (`Feed`, `ListingViewList`,
 * `Missions`, `WishList`); `Search.tsx` keeps its `FlatList` and imports `GRID_ROW_CLASS`/
 * `GRID_CELL_CLASS` directly instead (design.md D2) so the default column ramp exists in exactly
 * one string.
 */
export default function ListingGrid({
  children,
  className,
  columnRamp = LISTING_COLUMN_RAMP,
  lastFullOnOdd = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Column ramp per breakpoint. Defaults to the listing 1/2/3/4 ramp. */
  columnRamp?: ColumnRamp;
  /** When true and the child count is odd, the last child spans the full row width. */
  lastFullOnOdd?: boolean;
}) {
  const cellClass = gridCellClass(columnRamp);
  const fullCellClass = gridCellClass({ base: 1 });
  const childArray = React.Children.toArray(children);
  const lastIsOdd = lastFullOnOdd && childArray.length % 2 === 1;
  return (
    <View className={twMerge(GRID_ROW_CLASS, className)}>
      {childArray.map((child, index) => (
        <View
          key={index}
          className={lastIsOdd && index === childArray.length - 1 ? fullCellClass : cellClass}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
