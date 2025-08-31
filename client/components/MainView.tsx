import { View } from "react-native";

export const MainView = ({ children }: { children: React.ReactNode }) => {
  return <View className="flex-1">{children}</View>;
};
