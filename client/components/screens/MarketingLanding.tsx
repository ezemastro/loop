import { ScrollView, Text, View } from "react-native";

// Placeholder for the public marketing landing. Routing wiring lands first (T1); the real
// sections, copy, screenshots and motion land in a follow-up commit (T3).
export default function MarketingLanding() {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-center text-2xl font-bold text-main-text">Loop</Text>
      </View>
    </ScrollView>
  );
}
