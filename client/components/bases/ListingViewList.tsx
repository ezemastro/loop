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
}: {
  listings: Listing[];
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}) {
  return (
    <View>
      <View className="gap-2">
        <ListingGrid>
          {listings.map((listing) => (
            <Listing key={listing.id} listing={listing} />
          ))}
        </ListingGrid>
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
