import { Text } from "react-native";

export default function TextTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-center text-2xl text-main-text">{children}</Text>
  );
}
