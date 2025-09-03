import { Text } from "react-native";

export default function TextInfo({ children }: { children: string }) {
  return <Text className="text-secondary-text text-center">{children}</Text>;
}
