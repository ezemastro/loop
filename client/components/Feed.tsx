import { useListings } from "@/hooks/useListings";
import { Text, View } from "react-native";
import Listing from "./cards/Listing";
import ListingGrid from "./bases/ListingGrid";
import { useEffect } from "react";
import EmptyState from "./bases/EmptyState";
import { SearchIcon } from "./Icons";
import Error from "./Error";
import { useAuth } from "@/hooks/useAuth";

export default function Feed({
  saveMoreFunction,
}: {
  saveMoreFunction?: (getMore: () => void) => void;
}) {
  const { user } = useAuth();
  const { data, isLoading, isError, fetchNextPage, hasNextPage } = useListings({
    sort: "createdAt",
    userId: user?.id,
  });
  useEffect(() => {
    if (data && saveMoreFunction) {
      saveMoreFunction(fetchNextPage);
    }
  }, [data, saveMoreFunction, fetchNextPage]);

  const listings = data?.pages.flatMap((page) => page?.data?.listings) || [];
  return (
    <View className="gap-3">
      <ListingGrid isLoading={isLoading}>
        {listings
          .filter((listing) => !!listing)
          .map((listing) => (
            <Listing key={listing.id} listing={listing} />
          ))}
      </ListingGrid>
      {isError && <Error>Algo salió mal</Error>}
      {!isLoading && !isError && listings.length === 0 && (
        <EmptyState
          icon={<SearchIcon size={36} className="text-secondary-text" />}
          title="Todavía no hay publicaciones"
          description="Cuando alguien de tu comunidad publique, lo vas a ver acá."
        />
      )}
      {!hasNextPage && !isLoading && listings.length > 0 && (
        <Text className="text-center text-secondary-text mt-2">No hay más publicaciones</Text>
      )}
    </View>
  );
}
