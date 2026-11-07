import CustomButton from "./bases/CustomButton";
import { MessageIcon } from "./Icons";
import ButtonText from "./bases/ButtonText";
import { useRouter } from "expo-router";

export default function AskButton({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <CustomButton
      variant="secondary"
      size="sm"
      className="w-auto max-w-none"
      onPress={() => {
        router.push({
          pathname: "/(main)/(tabs)/messages/[userId]",
          params: { userId },
        });
      }}
    >
      <MessageIcon size={18} className="text-main-text" />
      <ButtonText>Preguntar</ButtonText>
    </CustomButton>
  );
}
