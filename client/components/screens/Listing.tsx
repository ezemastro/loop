import { useListing } from "@/hooks/useListing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, FlatList, Pressable } from "react-native";
import { BackIcon } from "../Icons";
import ReportButton from "../ReportButton";

export default function Listing() {
  const router = useRouter();
  const { listingId } = useLocalSearchParams();
  const { data, isLoading, error } = useListing({
    listingId: listingId as string,
  });
  const listing = data?.listing;

  const sections = [
    {
      key: "title",
      component: () => (
        <View className="flex-row justify-between items-center">
          <Pressable onPress={() => router.back()}>
            <BackIcon />
          </Pressable>
          <ReportButton />
        </View>
      ),
    },
  ];
  return (
    <View>
      <FlatList
        data={sections}
        renderItem={({ item }) => item.component()}
        contentContainerClassName="p-4"
      />
    </View>
  );
}
