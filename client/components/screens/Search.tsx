import { useListings } from "@/hooks/useListings";
import { useSearchStore } from "@/stores/search";
import { useEffect, useState } from "react";
import { View, Text, FlatList } from "react-native";
import type { CellRendererProps } from "react-native";
import { useDebounce } from "use-debounce";
import Loader from "../Loader";
import Listing from "../cards/Listing";
import ListingSearchSortOptions from "../ListingSearchSortOptions";
import ListingSearchFilters, { FiltersValue } from "../ListingSearchFilters";
import { MainView, pageContentClassName } from "../bases/MainView";
import { GRID_ROW_CLASS, GRID_CELL_CLASS } from "../bases/ListingGrid";
import { useAuth } from "@/hooks/useAuth";

/**
 * react-native-web wraps every FlatList item in its own View. The width fraction must land on
 * that wrapper — the direct child of the flex-wrap row — or the percentage resolves against an
 * already-one-column-wide box and compounds (330px cell -> 83px card).
 */
const GridCell = ({ children, ...props }: CellRendererProps<Listing>) => (
  <View {...props} className={GRID_CELL_CLASS}>
    {children}
  </View>
);

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
  const filterRowClassName = pageContentClassName("wide", "flex-row p-4 gap-4 flex-shrink-0");
  const gridContentClassName = pageContentClassName("wide", GRID_ROW_CLASS);
  const { data, isLoading } = useListings(query);
  const listings = data?.pages.flatMap((page) => page!.data!.listings) || [];
  useEffect(() => {
    setQuery((prev) => ({
      ...prev,
      searchTerm: debouncedTerm,
    }));
  }, [debouncedTerm]);

  const handleSortChange = (newSort: { sortBy?: SortOptions; sortOrder?: OrderOptions }) => {
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
      <View className={filterRowClassName}>
        <ListingSearchFilters onChange={handleFiltersChange} value={filters} />
        <ListingSearchSortOptions onDebounce={handleSortChange} />
      </View>
      <FlatList
        className="flex-1 px-4"
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
        contentContainerClassName={gridContentClassName}
        CellRendererComponent={GridCell}
        renderItem={({ item }) => <Listing listing={item} />}
      />
    </MainView>
  );
}
