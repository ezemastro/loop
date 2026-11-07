import { Text, type TextProps } from "react-native";
import { twMerge } from "tailwind-merge";

/**
 * The landing's only text primitive. It adds `font-landing` (Figtree, self-hosted in
 * `public/fonts`, see `app/+html.tsx`) so the typeface applies to the landing alone: the rest of
 * the app and native keep their system font. react-native-web's `Text` does not inherit
 * `font-family` from its parent, so the class has to sit on every text node.
 */
export default function LandingText({ className, ...props }: TextProps) {
  return <Text {...props} className={twMerge("font-landing", className)} />;
}
