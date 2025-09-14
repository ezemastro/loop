import { useSessionStore } from "@/stores/session";
import { View, Text } from "react-native";
import { CreditIcon } from "../Icons";
import { formatNumber } from "@/utils/formatNumber";

export default function CreditsBalance() {
  const credits = useSessionStore((store) => store.user?.credits.balance);
  return (
    <View className="bg-background/70 p-1 px-3 rounded-full flex-row items-center gap-3">
      <CreditIcon />
      <Text className="text-credits-light font-medium text-lg">
        {formatNumber(credits || 0)}
      </Text>
    </View>
  );
}
