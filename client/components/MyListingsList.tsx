import { useAuth } from "@/hooks/useAuth";
import { useMyListings } from "@/hooks/useMyListings";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import ListingViewList from "./bases/ListingViewList";
import { useThemeColors } from "@/hooks/useThemeColors";
import EmptyState from "./bases/EmptyState";
import { MyListingsIcon } from "./Icons";

export default function MyListingsList({
  onHasResults,
}: {
  onHasResults?: (hasResults: boolean) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const { data, isError, isLoading, fetchNextPage, hasNextPage } = useMyListings({
    sellerId: user?.id,
  });
  const listings = data?.pages.flatMap((page) => page.data?.listings ?? []) || [];
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
      emptyState={
        <EmptyState
          icon={<MyListingsIcon size={36} color={colors.SECONDARY_TEXT} />}
          title="Todavía no publicaste nada"
          description="Lo que ya no usás puede servirle a alguien de tu comunidad."
          actionLabel="Publicar"
          onAction={() => router.push("/(main)/(tabs)/publish")}
        />
      }
    />
  );
}
