import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, FlatList, Pressable, Text } from "react-native";
import { BackIcon } from "../Icons";
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
              <Pressable onPress={() => router.back()}>
                <BackIcon />
              </Pressable>
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
                <AskButton />
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
                <Text className="text-md text-main-text">
                  {listing.description}
                </Text>
              </View>
              <ProductStatusBadge
                status={listing.productStatus}
                containerClassName="self-start"
              />
              <Text className="text-secondary-text">
                {listing.seller.school.name}
              </Text>
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
              <Text className="text-lg text-main-text">Vendedor:</Text>
              <Pressable className="shadow">
                <UserBadge
                  user={listing.seller}
                  textClassName="!text-main-text"
                  containerClassName="bg-white px-3 py-2 rounded-full self-start ml-4"
                />
              </Pressable>
            </View>
          ),
        },
        {
          key: "buttons",
          // TODO - Cambiar botones dependiendo del ListingStatus y si el usuario es el vendedor o no
          component: () => (
            <View className="p-4 gap-3">
              <ListingButtons listing={listing} onMutate={handleMutation} />
            </View>
          ),
        },
      ]
    : null;
  // TODO - Agregar deseados del vendedor
  // TODO - Agregar estadísticas de la publicación
  return (
    <View>
      <FlatList
        data={sections}
        renderItem={({ item }) => item.component()}
        ListEmptyComponent={
          isLoading ? (
            <Loader />
          ) : error ? (
            <Error>No se encontró la publicación</Error>
          ) : null
        }
      />
    </View>
  );
}
