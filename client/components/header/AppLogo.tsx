import { View, Text, Image } from "react-native";

export default function AppLogo() {
  return (
    <View className="flex-row items-center gap-2">
      <Image
        source={require("../../assets/logo.png")}
        className="size-8 bg-white rounded-full"
      />
      <Text className="text-white font-semibold tracking-wider text-xl">
        Loop
      </Text>
    </View>
  );
}
