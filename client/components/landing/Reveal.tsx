import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";

// Literal classes (Tailwind content scan), indexed by stagger step.
const DELAYS = ["", "delay-100", "delay-200", "delay-300", "delay-500"] as const;

type Props = {
  children: ReactNode;
  className?: string;
  /** Stagger step, 0-4 (0, 100, 200, 300, 500 ms). */
  step?: number;
  nativeID?: string;
};

/**
 * Fades and lifts its content in the first time it scrolls into view. Web only, CSS transition
 * driven by an `IntersectionObserver` (never a scroll listener), opacity/transform only.
 *
 * The hidden state is gated behind `motion-safe:`, so with `prefers-reduced-motion: reduce` the
 * content is simply visible from the first paint, and a browser without `IntersectionObserver`
 * reveals immediately. Replaces Reanimated's `entering` here: that runs once on mount (so every
 * section below the fold had finished "animating" before anyone saw it), and on web it gets stuck
 * near zero opacity whenever a display class sits on the same element.
 */
export default function Reveal({ children, className = "", step = 0, nativeID }: Props) {
  const ref = useRef<View>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setShown(true);
      return;
    }
    // On web, react-native-web's View ref is the underlying DOM element.
    const node = ref.current as unknown as Element | null;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const state = shown
    ? "opacity-100 translate-y-0"
    : "motion-safe:opacity-0 motion-safe:translate-y-6";
  const delay = DELAYS[Math.max(0, Math.min(step, DELAYS.length - 1))];

  return (
    <View
      ref={ref}
      nativeID={nativeID}
      className={`${className} ${state} ${delay} transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none`}
    >
      {children}
    </View>
  );
}
