import { useListings } from "@/hooks/useListings";
import { Text, View } from "react-native";
import Listing from "./cards/Listing";
import { useEffect } from "react";
import Loader from "./Loader";
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
      {listings
        .filter((listing) => !!listing)
        .map((listing) => (
          <Listing key={listing.id} listing={listing} />
        ))}
      {isLoading && <Loader />}
      {isError && <Error>Ha ocurrido un error</Error>}
      {!isLoading && listings.length === 0 && (
        <Error>No se han encontrado publicaciones</Error>
      )}
      {!hasNextPage && !isLoading && listings.length > 0 && (
        <Text className="text-center text-secondary-text mt-2">
          No hay más publicaciones
        </Text>
      )}
    </View>
  );
}
