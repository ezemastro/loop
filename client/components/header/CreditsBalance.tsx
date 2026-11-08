import { useSessionStore } from "@/stores/session";
import { View, Text } from "react-native";
import { CreditIcon } from "../Icons";
import { formatNumber } from "@/utils/formatNumber";

/** Neutral chip: only the amount carries the credits colour, so it is the one purple on screen. */
export default function CreditsBalance() {
  const credits = useSessionStore((store) => store.user?.credits.balance);
  return (
    <View
      accessibilityLabel={`Tenés ${formatNumber(credits || 0)} loopies`}
      className="mr-1 min-h-[32px] flex-row items-center gap-1.5 rounded-full bg-background px-3"
    >
      <CreditIcon size={18} />
      <Text
        className="text-base font-semibold text-credits"
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {formatNumber(credits || 0)}
      </Text>
    </View>
  );
}
