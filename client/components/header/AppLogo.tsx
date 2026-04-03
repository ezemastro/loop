import { View, Text, Image } from "react-native";

export default function AppLogo() {
  return (
    <View className="flex-row items-center gap-2">
      <View className="w-12 h-12 bg-white/90 rounded-full p-0.5">
        <Image
          source={require("../../assets/icon.png")}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
      <Text className="text-white font-semibold tracking-wider text-xl">
        Loop
      </Text>
    </View>
  );
}
