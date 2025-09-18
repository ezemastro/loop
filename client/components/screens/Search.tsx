import { useListings } from "@/hooks/useListings";
import { useSearchStore } from "@/stores/search";
import { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import { useDebounce } from "use-debounce";
import Loader from "../Loader";
import Listing from "../cards/Listing";
import ListingSearchSortOptions from "../ListingSearchSortOptions";
import ListingSearchFilters, { FiltersValue } from "../ListingSearchFilters";
import { MainView } from "../bases/MainView";
import { useAuth } from "@/hooks/useAuth";

export default function Search() {
  const searchTerm = useSearchStore((state) => state.query);
  const { user } = useAuth();
  const [debouncedTerm] = useDebounce(searchTerm, 500);
  const [query, setQuery] = useState<GetListingsRequest["query"]>({
    userId: user?.id,
  });
  const [filters, setFilters] = useState<FiltersValue>({
    school: null,
    category: null,
    user: null,
    productStatus: null,
  });
  const { data, isLoading } = useListings(query);
  const listings = data?.pages.flatMap((page) => page!.data!.listings) || [];
  useEffect(() => {
    setQuery((prev) => ({
      ...prev,
      searchTerm: debouncedTerm,
    }));
  }, [debouncedTerm]);

  const handleSortChange = (newSort: {
    sortBy?: SortOptions;
    sortOrder?: OrderOptions;
  }) => {
    setQuery((prev) => ({
      ...prev,
      sort: newSort.sortBy,
      order: newSort.sortOrder,
    }));
  };
  const handleFiltersChange = (newFilters: FiltersValue) => {
    setFilters(newFilters);
    setQuery((prev) => ({
      ...prev,
      categoryId: newFilters.category?.id,
      schoolId: newFilters.school?.id,
      userId: newFilters.user?.id,
      productStatus: newFilters.productStatus || undefined,
    }));
  };

  return (
    <MainView>
      <View className="flex-row p-4 gap-4 w-full">
        <ListingSearchFilters onChange={handleFiltersChange} value={filters} />
        <ListingSearchSortOptions onDebounce={handleSortChange} />
      </View>
      <FlatList
        data={listings}
        ListEmptyComponent={() => (
          <>
            <View className="h-40 justify-center items-center">
              {!isLoading && (
                <Text className="text-secondary-text text-center">
                  No se encontraron resultados
                </Text>
              )}
              {isLoading && <Loader />}
            </View>
          </>
        )}
        contentContainerClassName="px-4 gap-2"
        renderItem={({ item }) => <Listing listing={item} />}
      />
    </MainView>
  );
}
