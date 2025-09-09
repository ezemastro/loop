import { Pressable, type PressableProps } from "react-native";
import { twMerge } from "tailwind-merge";

export default function CustomButton({
  children,
  ...props
}: PressableProps & { children: React.ReactNode }) {
  return (
    <Pressable
      {...props}
      className={twMerge(`bg-tertiary p-3 rounded`, props.className)}
    >
      {children}
    </Pressable>
  );
}
