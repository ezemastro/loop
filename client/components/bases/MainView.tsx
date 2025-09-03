import { View } from "react-native";

export const MainView = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <View className={`flex-1 ${className}`}>{children}</View>;
};
