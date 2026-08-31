import { View } from "react-native";
import { twMerge } from "tailwind-merge";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Page-width variants for a screen's content. `wide` and `narrow` cap the column at different
 * widths; `full` is the escape hatch (no cap). Kept separate from the scroller mechanism below --
 * see `pageContentClassName`.
 */
export const WIDTH_CAPS = {
  /** Listing-heavy screens that should use the space. */
  wide: "max-w-6xl xl:max-w-[1400px]",
  /** Screens that look empty when stretched full width. */
  narrow: "max-w-3xl",
  /** Escape hatch: no cap. */
  full: "",
} as const;

export type MainViewWidth = keyof typeof WIDTH_CAPS;

/**
 * Cap classes (`w-full self-center` + the requested `width`'s `max-w-*`) for this screen's
 * content.
 *
 * `MainView` itself never applies a width cap to its own container -- every screen's own
 * `FlatList`/`ScrollView` lives directly inside that full-bleed container, so if `MainView` capped
 * it, the scroller would inherit the capped box as its own width and its scrollbar would render at
 * the inner column edge instead of the true viewport edge. Instead, apply this function's result
 * to:
 *   - the scroller's `contentContainerClassName`, so the scroller box stays full-bleed (scrollbar
 *     at the viewport edge) while the rendered rows are centered and capped, or
 *   - a plain `View`'s `className`, for content that sits *outside* the scroller as a sibling
 *     (a header above a `FlatList`, a footer button below one).
 *
 * Centering uses `self-center` (`align-self`), not `mx-auto` (`margin`): some callers combine this
 * with a grid's negative-margin gutter class (e.g. `ListingGrid`'s `-mx-1.5`), and `tailwind-merge`
 * treats `mx-*` classes as one conflict group -- whichever comes last would silently drop the
 * other. `align-self` is its own group, so it never collides with a caller's margin classes.
 *
 * `width` is a plain argument rather than context read from `MainView`: React context only
 * reaches descendants of a `Provider`, but every screen calls this function in the same
 * component that renders its `<MainView>`, i.e. a sibling, not a descendant. Each screen holds
 * its own `width` once, as a local constant, so it cannot drift between calls.
 */
export function pageContentClassName(width: MainViewWidth, className?: string): string {
  return twMerge("w-full self-center", WIDTH_CAPS[width], className);
}

export const MainView = ({
  children,
  className,
  safeBottom = false,
}: {
  children: React.ReactNode;
  className?: string;
  safeBottom?: boolean;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      className={twMerge("flex-1", className)}
      style={safeBottom ? { paddingBottom: insets.bottom } : {}}
    >
      {children}
    </View>
  );
};
