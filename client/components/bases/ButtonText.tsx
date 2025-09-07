import { Text, TextProps } from "react-native";

export default function ButtonText({ ...props }: TextProps) {
  return (
    <Text
      {...props}
      className={`text-white text-xl font-medium text-center ${props.className}`}
    >
      {props.children}
    </Text>
  );
}
