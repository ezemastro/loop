import { View, Text, Pressable } from "react-native";
import Listing from "../cards/Listing";
import ListingGrid from "./ListingGrid";
import Loader from "../Loader";
import EmptyState from "./EmptyState";
import { SearchIcon } from "../Icons";
import Error from "../Error";

export default function ListingViewList({
  listings,
  isLoading,
  isError,
  hasNextPage,
  fetchNextPage,
  variant = "grid",
  emptyState,
}: {
  listings: Listing[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /** `compact` for lists that only *reference* a listing; `grid` for browsing. */
  variant?: "grid" | "compact";
  /**
   * Shown when there are no results. `compact` lists default to nothing (they sit under a section
   * heading that its parent hides when empty); `grid` lists default to a generic empty state.
   */
  emptyState?: React.ReactNode;
}) {
  const defaultEmpty =
    variant === "compact" ? null : (
      <EmptyState
        icon={<SearchIcon size={36} className="text-secondary-text" />}
        title="No encontramos resultados"
      />
    );
  return (
    <View>
      <View className="gap-2">
        {/*
         * `compact` rows are full-width by design, so they must NOT go through `ListingGrid`:
         * its cells are width fractions (`md:w-1/2` ... `xl:w-1/4`), which would squeeze a row
         * card into a quarter-width column and truncate its title. Plain vertical stack instead.
         */}
        {variant === "compact" ? (
          <View className="gap-2">
            {listings.map((listing) => (
              <Listing key={listing.id} listing={listing} variant="compact" />
            ))}
          </View>
        ) : (
          <ListingGrid isLoading={isLoading}>
            {listings.map((listing) => (
              <Listing key={listing.id} listing={listing} variant={variant} />
            ))}
          </ListingGrid>
        )}
        {isLoading && variant === "compact" ? <Loader /> : null}
        {isError && <Error>Algo salió mal</Error>}
        {!isLoading && !isError && listings.length === 0 && (
          <>{emptyState === undefined ? defaultEmpty : emptyState}</>
        )}
      </View>
      {hasNextPage && !isLoading && (
        <Pressable className="p-4 items-center" onPress={() => fetchNextPage()}>
          <Text>Cargar más</Text>
        </Pressable>
      )}
    </View>
  );
}
