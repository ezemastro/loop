import { View, Text, Image } from "react-native";

export default function AppLogo() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require("../../assets/loop.png")}
        className="size-8 bg-white rounded-full object-contain"
        style={{ resizeMode: "contain" }}
      />
      <Text className="text-white font-semibold tracking-wider text-xl">
        Loop
      </Text>
    </View>
  );
}
