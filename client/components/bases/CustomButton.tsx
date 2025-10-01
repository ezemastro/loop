import { Pressable, type PressableProps } from "react-native";
import { twMerge } from "tailwind-merge";

export default function CustomButton({
  children,
  ...props
}: PressableProps & { children: React.ReactNode }) {
  return (
    <Pressable
      {...props}
      className={twMerge(
        `bg-tertiary p-3 rounded ${props.disabled ? "opacity-50" : "opacity-100"}`,
        props.className,
      )}
    >
      {children}
    </Pressable>
  );
}
