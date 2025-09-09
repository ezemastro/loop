import { Stack } from "expo-router";
import Header from "@/components/header/Header";
import { View } from "react-native";

export default function MainLayout() {
  return (
    <View className="flex-1 bg-white">
      <Header />
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </View>
  );
}
