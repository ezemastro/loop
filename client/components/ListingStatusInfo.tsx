import { View, Text } from "react-native";
import React from "react";
import { useAuth } from "@/hooks/useAuth";

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
              <Text className="font-bold">
                {listing.buyer?.firstName} {listing.buyer?.lastName}
              </Text>
              <Text>
                {" "}
                ha loopeado este artículo, elige que quieres recibir a cambio.
              </Text>
            </Text>
          </View>
        );
      }
      if (listing.buyerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Has loopeado este artículo, espera a que </Text>
              <Text className="font-bold">
                {listing.seller?.firstName} {listing.seller?.lastName}
              </Text>
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
              <Text className="font-bold">
                {listing.buyer?.firstName} {listing.buyer?.lastName}
              </Text>
            </Text>
          </View>
        );
      }
      if (listing.buyerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Debes recibir este artículo de </Text>
              <Text className="font-bold">
                {listing.seller?.firstName} {listing.seller?.lastName}
              </Text>
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
              <Text className="font-bold">
                {listing.buyer?.firstName} {listing.buyer?.lastName}
              </Text>
            </Text>
          </View>
        );
      }
      if (listing.buyerId === user?.id) {
        return (
          <View>
            <Text className="text-main-text text-center p-4">
              <Text>Has recibido este artículo de </Text>
              <Text className="font-bold">
                {listing.seller?.firstName} {listing.seller?.lastName}
              </Text>
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
