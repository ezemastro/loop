import { Text, Pressable, type PressableProps } from "react-native";

export default function CustomButton({
  children,
  ...props
}: PressableProps & { children: React.ReactNode }) {
  return (
    <Pressable
      {...props}
      className={`bg-tertiary p-3 rounded ${props.className}`}
    >
      <Text className="text-white text-xl font-medium text-center">
        {children}
      </Text>
    </Pressable>
  );
}
