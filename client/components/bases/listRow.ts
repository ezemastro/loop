import { twMerge } from "tailwind-merge";

export type RowPosition = "first" | "middle" | "last" | "only";

/** Position of row `index` in a list of `length` rows, for `listRowClassName`. */
export const rowPosition = (index: number, length: number): RowPosition =>
  length <= 1 ? "only" : index === 0 ? "first" : index === length - 1 ? "last" : "middle";

/**
 * Rows of one list card, drawn row by row (a FlatList cannot wrap its cells in a single View):
 * white, 1px `stroke`, `rounded-xl` only on the outer corners, and the top border of every row
 * but the first doubling as the divider. No shadow.
 */
export const listRowClassName = (position: RowPosition, className?: string) =>
  twMerge(
    "overflow-hidden bg-white border-stroke",
    position === "only" && "rounded-xl border",
    position === "first" && "rounded-t-xl border-x border-t",
    position === "middle" && "border-x border-t",
    position === "last" && "rounded-b-xl border",
    className,
  );
