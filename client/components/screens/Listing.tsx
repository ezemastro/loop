import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { twMerge } from "tailwind-merge";
import ImageGallery from "../ImageGallery";
import AskButton from "../AskButton";
import CategoryBadge from "../CategoryBadge";
import ProductStatusBadge from "../badges/ProductStatusBadge";
import CreditsBadge from "../badges/CreditsBadge";
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
 * Below `lg` (1024px) this is a single scrollable column with the action bar pinned at the bottom.
 * At `lg` and above the page is two columns inside the `wide` cap: the gallery, description and
 * impact tiles on the left, and one card on the right (about 360px, `position: sticky` on web)
 * holding title, price, condition, school, the primary action, "Preguntar", the seller row and
 * "Denunciar". Both arrangements render from the same page scroller, so crossing 1024px
 * re-lays out without remounting.
 *
 * Title, price, status and seller each render twice (mobile inline copy + desktop card) and are
 * hidden with `lg:hidden` / `max-lg:hidden`: they are presentational, with no mount effects.
 * `ListingButtons` also renders twice (mobile bottom bar + desktop card); it only registers
 * `useMutation` hooks and handlers, so the double mount is inert.
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
  const scrollContentClassName = pageContentClassName(
    "wide",
    "pb-6 lg:flex-row lg:items-start lg:gap-6 lg:p-6",
  );
  const buttonsRowClassName = twMerge(
    pageContentClassName("wide", "flex-row gap-4 p-4"),
    "lg:hidden",
  );
  if (!listing) {
    return (
      <MainView safeBottom>
        {isLoading ? <Loader /> : error ? <Error>No encontramos esta publicación</Error> : null}
      </MainView>
    );
  }
  const goToSeller = () =>
    router.push({
      pathname: "/(main)/user/[userId]",
      params: { userId: listing.seller.id },
    });
  const sellerRow = (
    <Pressable
      accessibilityRole="link"
      onPress={goToSeller}
      className="rounded-lg border border-stroke bg-white p-3 web:cursor-pointer hover:bg-background"
    >
      <UserBadge
        user={listing.seller}
        textClassName="text-base font-medium text-main-text"
        imageSize={40}
        containerClassName="gap-3"
      />
    </Pressable>
  );
  const price = (
    <CreditsBadge
      credits={listing.price}
      iconSize={24}
      containerClassName="self-start gap-2 px-0 py-0"
      numberClassName="text-xl font-semibold"
    />
  );
  const schools = listing.seller.schools.map((school) => (
    <Text className="text-sm text-secondary-text" key={school.id}>
      {school.name}
    </Text>
  ));
  const ownerActions =
    isOwner && listing.listingStatus === "published" ? (
      <View className="flex-row gap-2">
        <EditListingButton listingId={listing.id} label="Editar" />
        <DeleteListingButton
          listingId={listing.id}
          onDelete={() => router.back()}
          label="Eliminar"
        />
      </View>
    ) : null;
  // `position: sticky` exists only on web; native ignores it and the card just scrolls with the page.
  const stickyStyle =
    Platform.OS === "web" ? ({ position: "sticky", top: 16 } as object) : undefined;

  return (
    <MainView safeBottom className="flex-1">
      <ScrollView
        className="flex-1"
        refreshControl={<CustomRefresh />}
        contentContainerClassName={scrollContentClassName}
      >
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center justify-between p-4 lg:px-0 lg:pt-0">
            <BackButton />
            {/* Mobile owners keep edit/delete up here; at `lg` they live in the card. */}
            {ownerActions ? <View className="lg:hidden">{ownerActions}</View> : null}
          </View>
          <View className="mx-4 overflow-hidden rounded-xl border border-stroke bg-white py-3 lg:mx-0">
            <ImageGallery images={listing.media || []} />
          </View>
          <View className="gap-3 p-4 lg:px-0">
            <CategoryBadge category={listing.category} className="text-sm" />
            {/* Title, price, status and school sit in the card at `lg`. The description stays in
                the left column at every width: it is the long-form content. */}
            <Text className="text-2xl font-semibold text-main-text lg:hidden">{listing.title}</Text>
            {listing.description && (
              <Text className="text-base text-main-text">{listing.description}</Text>
            )}
            <View className="gap-3 lg:hidden">
              <View className="flex-row flex-wrap items-center gap-3">
                {price}
                <ProductStatusBadge status={listing.productStatus} />
              </View>
              <View>{schools}</View>
              {sellerRow}
              {!isOwner ? (
                <View className="flex-row items-center justify-between gap-2">
                  <AskButton userId={listing.seller.id} />
                  <ReportButton listing={listing} label="Denunciar" />
                </View>
              ) : null}
            </View>
          </View>
          <View className="px-4 lg:hidden">
            <ListingStatusInfo listing={listing} />
          </View>
          <View className="gap-3 p-4 lg:px-0">
            <TextHeading>Con este loop ahorrás</TextHeading>
            <Stats
              kgCo2={listing.category.stats?.kgCo2 || 0}
              kgWaste={listing.category.stats?.kgWaste || 0}
              lH2o={listing.category.stats?.lH2o || 0}
            />
          </View>
        </View>
        {/* Desktop action card. */}
        <View className="max-lg:hidden lg:w-[360px] lg:shrink-0" style={stickyStyle}>
          <View className="gap-3 rounded-xl border border-stroke bg-white p-4">
            <Text className="text-xl font-semibold text-main-text">{listing.title}</Text>
            {price}
            <ProductStatusBadge status={listing.productStatus} containerClassName="self-start" />
            <View>{schools}</View>
            <ListingStatusInfo listing={listing} />
            <View className="flex-row gap-2">
              <ListingButtons listing={listing} onMutate={handleMutation} />
            </View>
            {!isOwner ? (
              <View className="flex-row">
                <AskButton userId={listing.seller.id} size="md" className="flex-grow" />
              </View>
            ) : (
              ownerActions
            )}
            {sellerRow}
            {!isOwner ? (
              <View className="flex-row">
                <ReportButton listing={listing} label="Denunciar" />
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
      <View className={buttonsRowClassName}>
        <ListingButtons listing={listing} onMutate={handleMutation} />
      </View>
    </MainView>
  );
}

const TextHeading = ({ children }: { children: string }) => (
  <Text accessibilityRole="header" className="text-lg font-semibold text-main-text">
    {children}
  </Text>
);
