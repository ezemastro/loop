import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, FlatList, Pressable, Text } from "react-native";
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
import { MainView } from "../bases/MainView";
import CustomRefresh from "../CustomRefresh";
import ListingStatusInfo from "../ListingStatusInfo";
import Stats from "../Stats";

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

  const sections = listing
    ? [
        {
          key: "title",
          component: () => (
            <View className="flex-row justify-between items-center p-4">
              <BackButton />
              {isOwner ? (
                listing.listingStatus === "published" && (
                  <View className="flex-row gap-2">
                    <DeleteListingButton
                      listingId={listing.id}
                      onDelete={() => router.back()}
                    />
                    <EditListingButton listingId={listing.id} />
                  </View>
                )
              ) : (
                <AskButton userId={listing.seller.id} />
              )}
            </View>
          ),
        },
        {
          key: "images",
          component: () => <ImageGallery images={listing?.media || []} />,
        },
        {
          key: "details",
          component: () => (
            <View className="p-4 gap-3">
              <CategoryBadge category={listing.category} />
              <View className="gap-1">
                <Text className="text-2xl font-bold text-main-text">
                  {listing.title}
                </Text>
                {listing.description && (
                  <Text className="text-md text-main-text">
                    {listing.description}
                  </Text>
                )}
              </View>
              <ProductStatusBadge
                status={listing.productStatus}
                containerClassName="self-start"
              />
              {listing.seller.schools.map((school) => (
                <Text className="text-secondary-text" key={school.id}>
                  {school.name}
                </Text>
              ))}
            </View>
          ),
        },
        {
          key: "price",
          component: () => (
            <BigCreditsBadge
              credits={listing.price}
              containerClassName="self-start ml-2"
            />
          ),
        },
        {
          key: "seller",
          component: () => (
            <View className="p-4 gap-3">
              <Pressable
                className="shadow"
                onPress={() =>
                  router.push({
                    pathname: "/(main)/user/[userId]",
                    params: { userId: listing.seller.id },
                  })
                }
              >
                <UserBadge
                  user={listing.seller}
                  textClassName="text-main-text text-lg"
                  imageClassName="size-12"
                  containerClassName="bg-white px-4 py-2 gap-4 rounded-full self-start"
                />
              </Pressable>
            </View>
          ),
        },
        {
          key: "status",
          component: () => (
            <View>
              <ListingStatusInfo listing={listing} />
            </View>
          ),
        },
        {
          key: "stats",
          component: () => (
            <View className="gap-3 p-4">
              <Text className="text-2xl font-semibold text-main-text">
                Con este loop ahorras:
              </Text>
              <Stats listing={listing} />
            </View>
          ),
        },
      ]
    : null;
  // TODO - Agregar deseados del vendedor
  // TODO - Agregar estadísticas de la publicación
  // TODO - Agregar datos del comprador si hay
  return (
    <MainView safeBottom>
      <FlatList
        data={sections}
        refreshControl={<CustomRefresh />}
        className="flex-grow"
        renderItem={({ item }) => item.component()}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <Error>No se encontró la publicación</Error>
          ) : null
        }
      />
      <View className="p-4 flex-row gap-4">
        {listing && (
          <ListingButtons listing={listing} onMutate={handleMutation} />
        )}
      </View>
    </MainView>
  );
}
