import { Text } from "react-native";

export default function TextTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text className={`text-center text-2xl text-main-text ${className}`}>
      {children}
    </Text>
  );
}
