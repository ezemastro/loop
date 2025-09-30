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
  setHasResults,
  setResultsCount,
  resultsCount,
  filterUserId,
}: {
  type: PendingType;
  hasResults?: boolean;
  setHasResults?: (has: boolean) => void;
  setResultsCount?: (count: number) => void;
  resultsCount?: number;
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
  const { data, isError, isLoading, fetchNextPage, hasNextPage } =
    useMyListings(getParams());
  const listings = data?.pages.flatMap((page) => page!.data!.listings) || [];
  useEffect(() => {
    if ((listings.length !== 0) === hasResults) return;
    setHasResults?.(listings.length !== 0);
  }, [listings.length, hasResults, setHasResults]);
  useEffect(() => {
    if (listings.length === resultsCount) return;
    setResultsCount?.(listings.length);
  }, [listings.length, setResultsCount, resultsCount]);
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
