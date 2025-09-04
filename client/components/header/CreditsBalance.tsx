import { useSessionStore } from "@/stores/session";
import { View, Text } from "react-native";
import { CreditIcon } from "../Icons";

export default function CreditsBalance() {
  const credits = useSessionStore((store) => store.user?.credits.balance);
  return (
    <View className="bg-white/20 p-1 px-3 rounded-full flex-row items-center gap-3">
      <CreditIcon />
      <Text className="text-white font-medium text-lg">{credits}</Text>
    </View>
  );
}
