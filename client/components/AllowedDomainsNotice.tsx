import { View, Text } from "react-native";
import { VALID_EMAIL_DOMAINS } from "@/config";

const ALLOWED_DOMAINS_TEXT = VALID_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(", ");

export default function AllowedDomainsNotice() {
  return (
    <View className="bg-primary/10 border border-primary/30 rounded-lg p-3 mx-4">
      <Text className="color-main-text text-center text-base font-semibold mb-1">
        Solo podrás acceder con correos de estos dominios:
      </Text>
      <Text className="color-main-text text-center text-sm">{ALLOWED_DOMAINS_TEXT}</Text>
    </View>
  );
}
