import { Link, type Href } from "expo-router";
import { Pressable } from "react-native";
import Text from "./LandingText";

type Variant = "primary" | "secondary" | "inverse";

type Props = {
  href: "/ingresar" | "/register" | "/demo";
  label: string;
  accessibilityLabel: string;
  variant?: Variant;
  size?: "md" | "sm";
};

// Full literal class strings (not composed fragments) so Tailwind's content scan sees every one.
const CONTAINER: Record<Variant, string> = {
  primary: "bg-primary hover:bg-primary/90 focus-visible:outline-primary",
  secondary: "border-2 border-secondary hover:bg-secondary/10 focus-visible:outline-secondary",
  inverse: "border-2 border-white hover:bg-white/10 focus-visible:outline-white",
};

const LABEL: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-secondary",
  inverse: "text-white",
};

/**
 * The landing's only button shape: a real anchor (`Link asChild`) styled as a pill, with a small
 * lift on hover, a press-down on click and a visible keyboard focus ring. One label per intent
 * across the page: "Ingresar" always goes to `/ingresar` (only in the nav), "Crear cuenta" to
 * `/register` and "Probá la demo" to `/demo`, which opens as a full page.
 */
export default function LandingButton({
  href,
  label,
  accessibilityLabel,
  variant = "primary",
  size = "md",
}: Props) {
  const padding = size === "sm" ? "px-5 py-2.5" : "px-7 py-4";

  // `/demo` is a real route (`app/demo.tsx`); the cast keeps this compiling while the gitignored
  // typed-routes file is stale.
  return (
    <Link href={href as Href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        className={`rounded-full ${padding} ${CONTAINER[variant]} transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
      >
        <Text className={`text-center text-sm font-bold ${LABEL[variant]}`}>{label}</Text>
      </Pressable>
    </Link>
  );
}
