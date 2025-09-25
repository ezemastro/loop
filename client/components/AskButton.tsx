import CustomButton from "./bases/CustomButton";
import { MessageIcon } from "./Icons";
import ButtonText from "./bases/ButtonText";
import { useRouter } from "expo-router";

export default function AskButton({ userId }: { userId: string }) {
  const router = useRouter();
  return (
    <CustomButton
      className="flex-row items-center gap-2"
      onPress={() => {
        router.push({
          pathname: "/(main)/(tabs)/messages/[userId]",
          params: { userId },
        });
      }}
    >
      <MessageIcon className="text-white" />
      <ButtonText className="font-light">Preguntar</ButtonText>
    </CustomButton>
  );
}
