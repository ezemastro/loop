import { View, Text, Image, Pressable } from "react-native";
import React from "react";
import ProductStatusBadge from "../badges/ProductStatusBadge";
import UserBadge from "../badges/UserBadge";
import CreditsBadge from "../badges/CreditsBadge";
import { useRouter } from "expo-router";
import { getUrl } from "@/services/getUrl";

export default function Listing({
  listing,
  customButton,
}: {
  listing: Listing;
  customButton?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Pressable
      className="flex-row px-2 py-3 bg-white rounded-xl shadow border border-stroke gap-2"
      onPress={() =>
        router.push({
          pathname: "/(main)/listing/[listingId]",
          params: { listingId: listing.id.toString() },
        })
      }
    >
      <View>
        <Image
          source={{ uri: getUrl(listing.media[0].url) }}
          className="h-28 w-24"
          style={{ objectFit: "contain" }}
        />
      </View>
      <View className="flex-1 gap-2">
        <View>
          <Text className="text-lg font-medium text-main-text">
            {listing.title}
          </Text>
          <Text className="text-sm text-secondary-text">
            {listing.category.parents?.map((parent) => parent.name).join("/")}/
            {listing.category.name}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <ProductStatusBadge status={listing.productStatus} />
          <Text className="text-main-text text-sm">
            {listing.seller.school.name}
          </Text>
        </View>
        <UserBadge user={listing.seller} />
      </View>
      <View className="justify-center gap-2">
        {customButton}
        <CreditsBadge credits={listing.price} />
      </View>
    </Pressable>
  );
}
