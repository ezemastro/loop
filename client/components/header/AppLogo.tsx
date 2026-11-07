import { View, Text, Image } from "react-native";

export default function AppLogo() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: 32, height: 32, borderRadius: 8 }}
        resizeMode="contain"
      />
      <Text className="text-xl font-semibold text-main-text">Loop</Text>
    </View>
  );
}
