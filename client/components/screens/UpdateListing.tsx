import { View } from "react-native";
import ModifyListing from "../ModifyListing";
import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams } from "expo-router";

export default function EditListing() {
  const { listingId } = useLocalSearchParams() as { listingId: string };
  const { data } = useListing({ listingId });
  const listing = data?.listing;
  return (
    <View>
      <ModifyListing backButton={true} initialData={listing} action={"edit"} />
    </View>
  );
}
