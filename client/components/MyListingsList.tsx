import { useAuth } from "@/hooks/useAuth";
import { useMyListings } from "@/hooks/useMyListings";
import { useEffect } from "react";
import ListingViewList from "./bases/ListingViewList";

export default function MyListingsList({
  onHasResults,
}: {
  onHasResults?: (hasResults: boolean) => void;
}) {
  const { user } = useAuth();
  const { data, isError, isLoading, fetchNextPage, hasNextPage } =
    useMyListings({
      sellerId: user?.id,
    });
  const listings = data?.pages.flatMap((page) => page!.data!.listings) || [];
  useEffect(() => {
    onHasResults?.(listings.length > 0);
  }, [listings.length, onHasResults]);

  return (
    <ListingViewList
      listings={listings}
      isLoading={isLoading}
      isError={isError}
      hasNextPage={!!hasNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}
