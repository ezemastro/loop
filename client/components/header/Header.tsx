import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppLogo from "./AppLogo";
import CreditsBalance from "./CreditsBalance";
import Messages from "./Messages";
import Notifications from "./Notifications";
import HeaderSearchBar from "./HeaderSearchBar";
import { usePathname, useRouter } from "expo-router";

export default function Header() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const isSearchScreen = pathname === "/search";
  return (
    <View
      className="bg-secondary p-5 gap-4 shadow shadow-black z-50"
      style={{
        paddingTop: insets.top,
      }}
    >
      <View className="flex-row justify-between pt-3">
        <View>
          <AppLogo />
        </View>
        <View className="flex-row items-center gap-4">
          <CreditsBalance />
          <Pressable onPress={() => router.push("/(main)/(tabs)/messages")}>
            <Messages />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(main)/(tabs)/notifications")}
          >
            <Notifications />
          </Pressable>
        </View>
      </View>
      <View>
        <HeaderSearchBar
          isSearchScreen={isSearchScreen}
          onNavigate={() => router.push("/(main)/(tabs)/search")}
        />
      </View>
    </View>
  );
}
