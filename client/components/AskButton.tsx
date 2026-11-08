import { twMerge } from "tailwind-merge";
import CustomButton from "./bases/CustomButton";
import { MessageIcon } from "./Icons";
import ButtonText from "./bases/ButtonText";
import { useRouter } from "expo-router";

export default function AskButton({
  userId,
  size = "sm",
  className,
}: {
  userId: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  return (
    <CustomButton
      variant="secondary"
      size={size}
      className={twMerge("w-auto max-w-none", className)}
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
