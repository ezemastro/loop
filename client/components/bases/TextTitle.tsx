import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

export default function TextTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text className={twMerge("text-center text-2xl text-main-text", className)}>
      {children}
    </Text>
  );
}
