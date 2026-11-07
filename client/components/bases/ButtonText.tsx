import { Text, TextProps } from "react-native";
import { twMerge } from "tailwind-merge";
import { useButtonContext } from "./ButtonContext";
import { SIZE_TEXT, VARIANT_TEXT } from "./buttonStyles";

/** Label of a `CustomButton`: colour and size follow the button's variant and size. */
export default function ButtonText({ className, ...props }: TextProps) {
  const { variant, size } = useButtonContext();
  return (
    <Text
      {...props}
      className={twMerge(
        "font-semibold text-center",
        SIZE_TEXT[size],
        VARIANT_TEXT[variant],
        className,
      )}
    />
  );
}
