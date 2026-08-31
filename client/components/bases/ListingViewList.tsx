import { View, Text, Pressable } from "react-native";
import Listing from "../cards/Listing";
import ListingGrid from "./ListingGrid";
import Loader from "../Loader";
import Error from "../Error";

export default function ListingViewList({
  listings,
  isLoading,
  isError,
  hasNextPage,
  fetchNextPage,
  variant = "grid",
}: {
  listings: Listing[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /** `compact` for lists that only *reference* a listing; `grid` for browsing. */
  variant?: "grid" | "compact";
}) {
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
          <ListingGrid>
            {listings.map((listing) => (
              <Listing key={listing.id} listing={listing} variant={variant} />
            ))}
          </ListingGrid>
        )}
        {isLoading && <Loader />}
        {isError && <Error>Error al cargar las publicaciones</Error>}
        {!isLoading && !isError && listings.length === 0 && (
          <Error textClassName="text-secondary-text">No se han encontrado publicaciones</Error>
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
