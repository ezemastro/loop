import { Text, TextProps } from "react-native";
import { twMerge } from "tailwind-merge";

export default function ButtonText({ ...props }: TextProps) {
  return (
    <Text
      {...props}
      className={twMerge("text-white text-xl font-medium text-center", props.className)}
    >
      {props.children}
    </Text>
  );
}
