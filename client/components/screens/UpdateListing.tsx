import { useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { BackIcon } from "../Icons";

export default function UpdateListing() {
  const router = useRouter();
  return (
    <View>
      <Pressable onPress={() => router.back()} className="p-2">
        <BackIcon />
      </Pressable>
      <Text>UpdateListing</Text>
    </View>
  );
}
