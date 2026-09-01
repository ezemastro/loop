import { View, Text } from "react-native";
import React from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

/** Visual affordance so the nested `Text` reads as tappable (no `Pressable` — see `NameLink`). */
const NAME_LINK_CLASS = "font-bold underline";

/**
 * Links the other party's name to their profile. A nested `<Text>` inside a `<Text>` cannot be
 * wrapped in a `Pressable` on React Native without breaking the text flow — `onPress` on the
 * `Text` itself is the supported alternative, reusing the same route
 * `components/screens/Listing.tsx` pushes for the seller badge.
 */
function NameLink({
  userId,
  firstName,
  lastName,
}: {
  userId?: string;
  firstName?: string;
  lastName?: string;
}) {
  const router = useRouter();
  return (
    <Text
      className={NAME_LINK_CLASS}
      onPress={() =>
        userId &&
        router.push({
          pathname: "/(main)/user/[userId]",
          params: { userId },
        })
      }
    >
      {firstName} {lastName}
    </Text>
  );
}

export default function ListingStatusInfo({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  switch (listing.listingStatus) {
    case "published":
      return null;
    case "offered":
      if (listing.sellerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <NameLink
                userId={listing.buyer?.id}
                firstName={listing.buyer?.firstName}
                lastName={listing.buyer?.lastName}
              />
              <Text> quiere loopear este artículo, elige que quieres recibir a cambio.</Text>
            </Text>
          </View>
        );
      }
      if (listing.buyerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Has loopeado este artículo, espera a que </Text>
              <NameLink
                userId={listing.seller?.id}
                firstName={listing.seller?.firstName}
                lastName={listing.seller?.lastName}
              />
              <Text> elija que quiere recibir a cambio.</Text>
            </Text>
          </View>
        );
      }
    case "accepted":
      if (listing.sellerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Debes entregar este artículo a </Text>
              <NameLink
                userId={listing.buyer?.id}
                firstName={listing.buyer?.firstName}
                lastName={listing.buyer?.lastName}
              />
            </Text>
          </View>
        );
      }
      if (listing.buyerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Debes recibir este artículo de </Text>
              <NameLink
                userId={listing.seller?.id}
                firstName={listing.seller?.firstName}
                lastName={listing.seller?.lastName}
              />
            </Text>
          </View>
        );
      }
    case "received":
      if (listing.sellerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Has entregado este artículo a </Text>
              <NameLink
                userId={listing.buyer?.id}
                firstName={listing.buyer?.firstName}
                lastName={listing.buyer?.lastName}
              />
            </Text>
          </View>
        );
      }
      if (listing.buyerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Has recibido este artículo de </Text>
              <NameLink
                userId={listing.seller?.id}
                firstName={listing.seller?.firstName}
                lastName={listing.seller?.lastName}
              />
            </Text>
          </View>
        );
      }
      return (
        <View>
          <Text className="text-main-text text-center p-4">
            Este artículo ha sido intercambiado.
          </Text>
        </View>
      );
  }
  return (
    <View>
      <Text className="text-main-text text-center p-4">
        Este artículo está en proceso de intercambio.
      </Text>
    </View>
  );
}
