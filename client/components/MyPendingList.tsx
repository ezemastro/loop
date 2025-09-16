import { useMyListings } from "@/hooks/useMyListings";
import ListingViewList from "./bases/ListingViewList";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

type PendingType =
  | "to-receive"
  | "to-deliver"
  | "to-accept"
  | "waiting-acceptance";
export default function MyPendingList({
  type,
  hasResults,
}: {
  type: PendingType;
  hasResults: (has: boolean) => void;
}) {
  const { user } = useAuth();
  const getParams = (): GetSelfListingsRequest["query"] => {
    switch (type) {
      case "to-receive":
        return {
          buyerId: user?.id,
          listingStatus: "accepted",
        };
      case "to-deliver":
        return {
          sellerId: user?.id,
          listingStatus: "accepted",
        };
      case "to-accept":
        return {
          sellerId: user?.id,
          listingStatus: "offered",
        };
      case "waiting-acceptance":
        return {
          buyerId: user?.id,
          listingStatus: "offered",
        };
    }
  };
  const { data, isError, isLoading, fetchNextPage, hasNextPage } =
    useMyListings(getParams());
  const listings = data?.pages.flatMap((page) => page!.data!.listings) || [];
  useEffect(() => {
    hasResults(listings.length > 0);
  }, [listings.length, hasResults]);
  return (
    <ListingViewList
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      isError={isError}
      isLoading={isLoading}
      listings={listings}
    />
  );
}
