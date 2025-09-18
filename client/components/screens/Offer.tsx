import { View, Text, FlatList, Pressable } from "react-native";
import { MainView } from "../bases/MainView";
import Listing from "../cards/Listing";
import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CreditIcon, MinusCircleIcon, PlusCircleIcon } from "../Icons";
import { useAuth } from "@/hooks/useAuth";
import { formatNumber } from "@/utils/formatNumber";
import { useState } from "react";
import { useListings } from "@/hooks/useListings";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { useListingAcceptOffer } from "@/hooks/useListingAcceptOffer";
import Loader from "../Loader";
import { useListingRejectOffer } from "@/hooks/useListingRejectOffer";
import { useQueryClient } from "@tanstack/react-query";
import BackButton from "../BackButton";

interface Section {
  key: string;
  show?: boolean;
  component: () => React.ReactNode;
}
const LoopTrade = ({
  credits,
  positive,
  maxCredits,
  className,
}: {
  credits: number;
  positive: boolean;
  maxCredits: number;
  className?: string;
}) => {
  return (
    <View
      className={`w-full rounded-full items-center justify-between flex-row px-6 py-1 ${positive ? "bg-credits-light/10" : "bg-alert/15"} ${className}`}
    >
      <CreditIcon size={48} />
      <Text className="text-credits text-3xl">{formatNumber(credits)}</Text>
      <Text className="self-end text-credits">
        Max. {formatNumber(maxCredits)}
      </Text>
    </View>
  );
};
const SelectListingButton = ({
  type,
  onPress,
}: {
  type: "remove" | "add";
  onPress?: () => void;
}) => {
  return (
    <Pressable onPress={onPress}>
      <View className="items-center justify-center gap-0.5">
        {type === "remove" ? (
          <>
            <MinusCircleIcon className="text-primary" size={32} />
            <Text className="text-primary font-medium">Eliminar</Text>
          </>
        ) : (
          <>
            <PlusCircleIcon className="text-tertiary" size={32} />
            <Text className="text-tertiary font-medium">Agregar</Text>
          </>
        )}
      </View>
    </Pressable>
  );
};

export default function Offer() {
  const queryClient = useQueryClient();
  const { listingId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const { data: listingData, isLoading: isLoadingListing } = useListing({
    listingId: listingId as string,
  });
  const {
    data: buyerListingsData,
    fetchNextPage,
    isLoading: isLoadingBuyerListings,
  } = useListings({
    sellerId: listingData?.listing?.buyerId || undefined,
  });
  const [selectedListings, setSelectedListings] = useState<Listing[]>([]);
  const { mutate: acceptOffer, isPending: isLoadingAcceptOffer } =
    useListingAcceptOffer({
      listingId: listingId as string,
      tradingListingIds: selectedListings.map((l) => l.id),
    });
  const { mutate: rejectOffer, isPending: isLoadingRejectOffer } =
    useListingRejectOffer({
      listingId: listingId as string,
    });

  if (!listingId && typeof listingId !== "string") {
    if (router.canGoBack()) router.back();
    else router.replace("/");
    return null;
  }
  const listing = listingData?.listing;
  const buyerListings = listing?.buyerId
    ? buyerListingsData?.pages.flatMap((page) => page!.data!.listings)
    : [];
  const totalCredits =
    (listing?.price || 0) -
    (selectedListings.reduce((acc, curr) => acc + curr.price, 0) || 0);
  const isNegative = totalCredits < 0;
  const selectableListings =
    buyerListings?.filter((listing) =>
      selectedListings.every((l) => l.id !== listing.id),
    ) || [];
  const handleSubmit = () => {
    acceptOffer(undefined, { onSuccess });
  };
  const handleReject = () => {
    rejectOffer(undefined, {
      onSuccess,
    });
  };
  const onSuccess = () => {
    router.back();
    queryClient.invalidateQueries({
      queryKey: ["listing", listingId as string],
    });
    queryClient.invalidateQueries({ queryKey: ["listings"], exact: false });
  };
  const isLoading =
    isLoadingListing ||
    isLoadingBuyerListings ||
    isLoadingAcceptOffer ||
    isLoadingRejectOffer;
  const sections: Section[] = [
    {
      key: "header",
      component: () => (
        <View>
          <BackButton />
        </View>
      ),
    },
    {
      key: "mainListing",
      component: () => (
        <View className="gap-2">
          <Text className="text-main-text font-semibold text-lg">
            Elige que quieres recibir a cambio de:
          </Text>
          {listing && <Listing listing={listing} />}
        </View>
      ),
    },
    {
      key: "give",
      show: isNegative,
      component: () => (
        <View className="gap-2">
          <Text className="text-main-text font-semibold text-3xl">Darás</Text>
          <LoopTrade
            credits={totalCredits * -1}
            positive={false}
            maxCredits={user?.credits.balance || 0}
          />
        </View>
      ),
    },
    {
      key: "receive",
      component: () => (
        <View className="gap-2">
          <Text className="text-main-text font-semibold text-3xl">
            Recibirás
          </Text>
          <LoopTrade
            credits={Math.abs(totalCredits)}
            positive={true}
            maxCredits={listing?.offeredCredits ?? listing?.price ?? 0}
            className={isNegative ? "hidden" : ""}
          />
          {selectedListings.map((listing) => (
            <Listing
              key={listing.id}
              listing={listing}
              customButton={
                <SelectListingButton
                  type="remove"
                  onPress={() => {
                    setSelectedListings(
                      selectedListings.filter((l) => l.id !== listing.id),
                    );
                  }}
                />
              }
            />
          ))}
        </View>
      ),
    },
    {
      key: "availableListings",
      show: selectableListings.length > 0,
      component: () => (
        <View className="mt-4 gap-4">
          <Text className="text-main-text text-2xl">
            <Text className="text-main-text font-semibold">
              Publicaciones de
            </Text>{" "}
            <Text className="">
              {listing?.buyer?.firstName} {listing?.buyer?.lastName}
            </Text>
          </Text>
          <View className="gap-2">
            {selectableListings.map((listing) => (
              <Listing
                key={listing.id}
                listing={listing}
                customButton={
                  <SelectListingButton
                    type="add"
                    onPress={() => {
                      setSelectedListings([...selectedListings, listing]);
                    }}
                  />
                }
              />
            ))}
          </View>
        </View>
      ),
    },
  ];
  return (
    <MainView safeBottom>
      <FlatList
        data={sections}
        contentContainerClassName="p-4"
        onEndReached={() => fetchNextPage()}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <View className={item.show === false ? "hidden" : "mb-6"}>
            {item.component()}
          </View>
        )}
      />
      <View>
        {isLoading && <Loader />}
        <View className="px-4 mb-4 flex-row gap-4">
          <CustomButton className="flex-grow" onPress={handleSubmit}>
            <ButtonText>Confirmar</ButtonText>
          </CustomButton>
          <CustomButton className="bg-alert flex-1" onPress={handleReject}>
            <ButtonText className="text-alert">Cancelar</ButtonText>
          </CustomButton>
        </View>
      </View>
    </MainView>
  );
}
