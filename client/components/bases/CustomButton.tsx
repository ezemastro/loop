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
        // A standalone action button is capped and centred: the page column is up to 1400px wide
        // and a button that wide reads as an accident, not a decision. Buttons that are meant to
        // fill a `flex-row` bar opt out with `w-auto max-w-none` at their call site: without `w-auto`
        // the inherited `w-full` makes every sibling demand 100% of the row and the last one
        // collapses to a sliver.
        `bg-tertiary p-3 rounded self-center w-full max-w-md ${props.disabled ? "opacity-50" : "opacity-100"}`,
        props.className,
      )}
    >
      {children}
    </Pressable>
  );
}
