import { View, Text, Image } from "react-native";

export default function AppLogo() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require("../../assets/icon.png")}
        className="bg-white rounded-full"
        style={{ width: 32, height: 32 }}
        resizeMode="contain"
      />
      <Text className="text-white font-semibold tracking-wider text-xl">
        Loop
      </Text>
    </View>
  );
}
