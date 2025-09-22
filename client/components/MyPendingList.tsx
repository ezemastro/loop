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
  resultsCount,
  filterUserId,
}: {
  type: PendingType;
  hasResults?: (has: boolean) => void;
  resultsCount?: (count: number) => void;
  filterUserId?: string;
}) {
  const { user } = useAuth();
  const getParams = (): GetSelfListingsRequest["query"] => {
    switch (type) {
      case "to-receive":
        return {
          buyerId: user?.id,
          sellerId: filterUserId,
          listingStatus: "accepted",
        };
      case "to-deliver":
        return {
          sellerId: user?.id,
          buyerId: filterUserId,
          listingStatus: "accepted",
        };
      case "to-accept":
        return {
          sellerId: user?.id,
          buyerId: filterUserId,
          listingStatus: "offered",
        };
      case "waiting-acceptance":
        return {
          buyerId: user?.id,
          sellerId: filterUserId,
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
    hasResults?.(listings.length > 0);
    resultsCount?.(listings.length);
    hasResultsRef.current = true;
  }, [listings.length, hasResults, isSuccess, isFetching, resultsCount]);
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
