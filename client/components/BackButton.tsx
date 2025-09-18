import { Pressable } from "react-native";
import { BackIcon } from "./Icons";
import { useRouter } from "expo-router";

export default function BackButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/");
        }
      }}
    >
      <BackIcon className="text-main-text" size={26} />
    </Pressable>
  );
}
