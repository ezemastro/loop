import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppLogo from "./AppLogo";
import CreditsBalance from "./CreditsBalance";
import Messages from "./Messages";
import Notifications from "./Notifications";
import { ParamListBase, RouteProp } from "@react-navigation/native";

export default function Header({ route }: { route: RouteProp<ParamListBase> }) {
  const insets = useSafeAreaInsets();
  const isSearchScreen = route.name === "search";
  return (
    <View className="bg-secondary p-5" style={{ paddingTop: insets.top }}>
      <View className="flex-row justify-between">
        <View>
          <AppLogo />
        </View>
        <View className="flex-row items-center gap-4">
          <CreditsBalance />
          <Messages />
          <Notifications />
        </View>
      </View>
    </View>
  );
}
