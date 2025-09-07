import { Pressable, type PressableProps } from "react-native";

export default function CustomButton({
  children,
  ...props
}: PressableProps & { children: React.ReactNode }) {
  return (
    <Pressable
      {...props}
      className={`bg-tertiary p-3 rounded ${props.className}`}
    >
      {children}
    </Pressable>
  );
}
