import { Link, type Href } from "expo-router";
import { Pressable } from "react-native";
import Text from "./LandingText";
import { useLandingAccess } from "./useLandingAccess";

type Variant = "primary" | "secondary" | "inverse";

type Props = {
  href: "/ingresar" | "/register" | "/demo";
  label: string;
  accessibilityLabel: string;
  variant?: Variant;
  size?: "md" | "sm";
  /**
   * What the button becomes for a signed-in visitor: it keeps its place but leads into the app.
   * Buttons without it (the demo) are the same for everyone. `label` defaults to the signed-out one.
   */
  whenSignedIn?: { label?: string; accessibilityLabel?: string };
};

/** Routes that must load as a new document, not through the client router. */
const FULL_PAGE_LOAD = new Set<string>(["/demo"]);

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
 * across the page: "Ingresar" goes to `/ingresar` (only in the nav), "Crear cuenta" to `/register`
 * and "Probá la demo" to `/demo`, which opens as a full page. For a signed-in visitor "Ingresar"
 * and "Crear cuenta" go into the app instead (`whenSignedIn`).
 */
export default function LandingButton({
  href: signedOutHref,
  label: signedOutLabel,
  accessibilityLabel: signedOutAccessibilityLabel,
  variant = "primary",
  size = "md",
  whenSignedIn,
}: Props) {
  const { signedIn, enterHref } = useLandingAccess();
  const toApp = signedIn && whenSignedIn !== undefined;
  const href: string = toApp ? enterHref : signedOutHref;
  const label = (toApp && whenSignedIn.label) || signedOutLabel;
  const accessibilityLabel =
    (toApp && whenSignedIn.accessibilityLabel) || signedOutAccessibilityLabel;

  const padding = size === "sm" ? "px-5 py-2.5" : "px-7 py-4";

  // `/demo` is a real route (`app/demo.tsx`); the cast keeps this compiling while the gitignored
  // typed-routes file is stale.
  // `/demo` must be a real page load: its in-memory storage isolation is decided from the path the
  // document booted on, and a client-side transition from `/` would run it against the real
  // `localStorage`. The anchor keeps its `href` (open in new tab, crawlers); a plain click is
  // turned into a document navigation.
  const onPress = FULL_PAGE_LOAD.has(href)
    ? (event: { preventDefault?: () => void }) => {
        event.preventDefault?.();
        window.location.assign(href);
      }
    : undefined;

  return (
    <Link href={href as Href} onPress={onPress} asChild>
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
