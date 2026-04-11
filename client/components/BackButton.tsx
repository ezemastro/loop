import { Platform, Pressable } from "react-native";
import { BackIcon } from "./Icons";
import { useRouter } from "expo-router";

export default function BackButton() {
  const router = useRouter();

  return (
    <Pressable
      className="z-20 p-1"
      hitSlop={10}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          if (Platform.OS === "web") {
            router.replace("/(main)/(tabs)/home");
            return;
          }
          router.replace("/");
        }
      }}
    >
      <BackIcon className="text-main-text" size={26} />
    </Pressable>
  );
}
