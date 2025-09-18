import { useMyListings } from "@/hooks/useMyListings";
import ListingViewList from "./bases/ListingViewList";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef } from "react";

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
  const {
    data,
    isError,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isSuccess,
    isFetching,
  } = useMyListings(getParams());
  const listings = data?.pages.flatMap((page) => page!.data!.listings) || [];
  const hasResultsRef = useRef(false);
  useEffect(() => {
    if (!isSuccess || isFetching) return;
    if (hasResultsRef.current) return;
    hasResults(listings.length > 0);
    hasResultsRef.current = true;
  }, [listings.length, hasResults, isSuccess, isFetching]);
  useEffect(() => {
    if (isFetching) hasResultsRef.current = false;
  }, [isFetching]);
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
