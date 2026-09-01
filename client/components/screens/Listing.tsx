import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import ImageGallery from "../ImageGallery";
import AskButton from "../AskButton";
import CategoryBadge from "../CategoryBadge";
import ProductStatusBadge from "../badges/ProductStatusBadge";
import BigCreditsBadge from "../BigCreditsBadge";
import UserBadge from "../badges/UserBadge";
import ListingButtons from "../ListingButtons";
import Loader from "../Loader";
import Error from "../Error";
import { useAuth } from "@/hooks/useAuth";
import DeleteListingButton from "../buttons/DeleteListingButton";
import EditListingButton from "../buttons/EditListingButton";
import BackButton from "../BackButton";
import { MainView, pageContentClassName } from "../bases/MainView";
import CustomRefresh from "../CustomRefresh";
import ListingStatusInfo from "../ListingStatusInfo";
import Stats from "../Stats";
import ReportButton from "../ReportButton";

/**
 * Below `lg` (1024px) this renders as a single scrollable column, in the same order as before the
 * two-column rework. At `lg` and above, the action panel (title, price, product status, school,
 * seller badge, primary actions) becomes a flex sibling of the left scroller inside a
 * bounded-height row -- sticky by construction on both platforms, with its own internal scroll so
 * the primary action is never pushed off-screen. No CSS `position: sticky` and no JS breakpoint
 * branch, so crossing 1024px re-lays out without remounting or losing scroll position.
 *
 * The panel content (title text, price, product status, school, seller badge) is intentionally
 * re-rendered a second time inside the desktop aside rather than moved out of the shared "details"
 * block -- all are stateless/presentational (no mount effects), and duplicating them keeps the
 * mobile column's element order byte-for-byte unchanged. Price and seller keep their original
 * inline position too (`lg:hidden`), for the same reason. `ListingButtons` also renders twice
 * (mobile bottom bar + desktop aside) -- checked end to end, it only registers `useMutation` hooks
 * and event handlers, no mount effects, so double-mounting is inert.
 */
export default function Listing() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams();
  const { data, isLoading, error, refetch } = useListing({
    listingId: listingId as string,
  });
  const listing = data?.listing;
  const handleMutation = () => {
    refetch();
  };

  const { user } = useAuth();
  const isOwner = listing?.seller.id === user?.id;
  const scrollContentClassName = pageContentClassName("wide");
  const buttonsRowClassName = twMerge(
    pageContentClassName("wide", "p-4 flex-row gap-4"),
    "lg:hidden",
  );

  if (!listing) {
    return (
      <MainView safeBottom>
        {isLoading ? <Loader /> : error ? <Error>No se encontró la publicación</Error> : null}
      </MainView>
    );
  }

  const goToSeller = () =>
    router.push({
      pathname: "/(main)/user/[userId]",
      params: { userId: listing.seller.id },
    });

  const sellerBadge = (
    <Pressable onPress={goToSeller}>
      <UserBadge
        user={listing.seller}
        textClassName="text-main-text text-lg"
        imageSize={48}
        containerClassName="bg-white px-4 py-2 gap-4 rounded-full"
      />
    </Pressable>
  );

  const priceBadge = <BigCreditsBadge credits={listing.price} containerClassName="self-start" />;

  return (
    <MainView safeBottom className="flex-1 lg:flex-row lg:gap-6">
      <ScrollView
        className="flex-1"
        refreshControl={<CustomRefresh />}
        contentContainerClassName={scrollContentClassName}
      >
        <View className="z-20 flex-row justify-between items-center p-4">
          <BackButton />
          <View className="flex-row gap-2 items-center">
            {isOwner ? (
              listing.listingStatus === "published" && (
                <View className="flex-row gap-2">
                  <DeleteListingButton listingId={listing.id} onDelete={() => router.back()} />
                  <EditListingButton listingId={listing.id} />
                </View>
              )
            ) : (
              <>
                <ReportButton
                  listing={listing}
                  className="w-auto max-w-none px-3 py-2"
                  label="Denunciar"
                />
                <AskButton userId={listing.seller.id} />
              </>
            )}
          </View>
        </View>

        <ImageGallery images={listing.media || []} />

        <View className="p-4 gap-3">
          <CategoryBadge category={listing.category} />
          <View className="gap-1">
            {/* Title, status and schools move into the aside at `lg`, so their inline copies hide
                there. The description stays in the left column at every width: it is the long-form
                content the wide column exists for. */}
            <Text className="text-2xl font-bold text-main-text lg:hidden">{listing.title}</Text>
            {listing.description && (
              <Text className="text-md text-main-text">{listing.description}</Text>
            )}
          </View>
          <ProductStatusBadge
            status={listing.productStatus}
            containerClassName="self-start lg:hidden"
          />
          <View className="lg:hidden">
            {listing.seller.schools.map((school) => (
              <Text className="text-secondary-text" key={school.id}>
                {school.name}
              </Text>
            ))}
          </View>
        </View>

        {/* Mobile-only inline copies: at `lg` this content moves into the desktop aside below. */}
        <View className="lg:hidden">
          <View className="ml-2">{priceBadge}</View>
          <View className="p-4 gap-3 self-start">{sellerBadge}</View>
        </View>

        <ListingStatusInfo listing={listing} />

        <View className="gap-3 p-4">
          <Text className="text-2xl font-semibold text-main-text">Con este loop ahorras:</Text>
          <Stats
            kgCo2={listing.category.stats?.kgCo2 || 0}
            kgWaste={listing.category.stats?.kgWaste || 0}
            lH2o={listing.category.stats?.lH2o || 0}
          />
        </View>
      </ScrollView>

      {/* Desktop action panel: flex sibling of the scroller above, sticky by construction. */}
      <View className="max-lg:hidden lg:w-[380px] lg:shrink-0">
        <ScrollView className="flex-1">
          <View className="p-4 gap-3">
            <Text className="text-2xl font-bold text-main-text">{listing.title}</Text>
            {priceBadge}
            <ProductStatusBadge status={listing.productStatus} containerClassName="self-start" />
            {listing.seller.schools.map((school) => (
              <Text className="text-secondary-text" key={school.id}>
                {school.name}
              </Text>
            ))}
            {sellerBadge}
          </View>
        </ScrollView>
        <View className="p-4 flex-row gap-4">
          <ListingButtons listing={listing} onMutate={handleMutation} />
        </View>
      </View>

      <View className={buttonsRowClassName}>
        <ListingButtons listing={listing} onMutate={handleMutation} />
      </View>
    </MainView>
  );
}
