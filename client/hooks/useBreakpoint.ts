import { useWindowDimensions } from "react-native";
import { BREAKPOINTS } from "@/config";

export type Breakpoint = "base" | "md" | "lg" | "xl";

/**
 * Pure width→breakpoint resolver, kept separate from the hook so it can be unit-tested without
 * rendering. Ranges are inclusive of their lower bound, matching Tailwind's `min-width` semantics.
 */
export function resolveBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  return "base";
}

/**
 * Reserved for JS-side props that cannot be expressed as Tailwind classes (e.g. carousel
 * `height`, `Image` dimensions). Class prefixes (`md:`/`lg:`/`xl:`) remain the default mechanism.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return resolveBreakpoint(width);
}
