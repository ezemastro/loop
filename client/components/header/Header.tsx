import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppLogo from "./AppLogo";
import CreditsBalance from "./CreditsBalance";
import Messages from "./Messages";
import Notifications from "./Notifications";
import {
  ParamListBase,
  RouteProp,
  useIsFocused,
} from "@react-navigation/native";
import type { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import HeaderSearchBar from "./HeaderSearchBar";

export default function Header({
  route,
  navigation,
}: {
  route: RouteProp<ParamListBase>;
  navigation: BottomTabHeaderProps["navigation"];
}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const isSearchScreen = route.name === "search" && isFocused;
  return (
    <View className="bg-secondary p-5 gap-4" style={{ paddingTop: insets.top }}>
      <View className="flex-row justify-between pt-3">
        <View>
          <AppLogo />
        </View>
        <View className="flex-row items-center gap-4">
          <CreditsBalance />
          <Pressable onPress={() => navigation.navigate("messages")}>
            <Messages />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("notifications")}>
            <Notifications />
          </Pressable>
        </View>
      </View>
      <View>
        <HeaderSearchBar
          isSearchScreen={isSearchScreen}
          onNavigate={() => navigation.navigate("search")}
        />
      </View>
    </View>
  );
}
