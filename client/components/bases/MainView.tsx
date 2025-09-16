import { View } from "react-native";
import { twMerge } from "tailwind-merge";

export const MainView = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <View className={twMerge(`flex-1`, className)}>{children}</View>;
};
