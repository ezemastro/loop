import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/** `/demo` (app/demo.tsx) boots the real app in demo mode and lands on this path. */
export const LIVE_DEMO_SRC = "/demo";
const READY_PATH = "/home";

/** Only from `lg` up: below that a phone inside a phone makes no sense, the poster stays. */
const DESKTOP_QUERY = "(min-width: 1024px)";
/** Let the hero paint (and its images decode) before pulling a second copy of the app. */
const MOUNT_DELAY_MS = 700;
/** After the demo reached the feed, give it a beat to render its first frame before fading in. */
const SETTLE_MS = 500;
const POLL_MS = 200;
/** If the demo never reaches the feed, give up and keep the static poster. */
const GIVE_UP_MS = 15000;

const INTERACTION_EVENTS = ["pointerdown", "wheel", "keydown", "touchstart"] as const;

export type LiveDemoState = "poster" | "loading" | "live";

/**
 * Lifecycle of the hero phone's embedded live demo:
 * `poster` (static capture, nothing mounted) -> `loading` (iframe mounted, invisible) -> `live`
 * (iframe faded in over the poster). `touched` flips on the first interaction inside the iframe,
 * which hides the "Probala acá" hint.
 *
 * Readiness is read from the iframe itself (same origin): the demo is ready once its own router
 * reached the home feed. Anything else (slow network, an error inside the demo) leaves the poster
 * in place, so the hero never shows a blank or broken screen.
 */
export function useLiveDemo() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<LiveDemoState>("poster");
  const [touched, setTouched] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(DESKTOP_QUERY);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (!query.matches || timer) return;
      timer = setTimeout(() => setMounted(true), MOUNT_DELAY_MS);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    query.addEventListener("change", schedule);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("load", schedule);
      query.removeEventListener("change", schedule);
    };
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  const onFrameLoad = useCallback(() => {
    const frame = frameRef.current;
    const win = frame?.contentWindow;
    if (!win) return;
    cleanupRef.current?.();

    const startedAt = Date.now();
    let settle: ReturnType<typeof setTimeout> | undefined;
    const markTouched = () => setTouched(true);
    const poll = setInterval(() => {
      let path = "";
      try {
        path = win.location.pathname;
      } catch {
        // Cross-origin would throw here; the demo is same origin, so this only guards misuse.
      }
      if (path === READY_PATH) {
        clearInterval(poll);
        settle = setTimeout(() => setState("live"), SETTLE_MS);
        INTERACTION_EVENTS.forEach((type) =>
          win.addEventListener(type, markTouched, { once: true, passive: true }),
        );
      } else if (Date.now() - startedAt > GIVE_UP_MS) {
        clearInterval(poll);
        setState("poster");
        setMounted(false);
      }
    }, POLL_MS);

    cleanupRef.current = () => {
      clearInterval(poll);
      if (settle) clearTimeout(settle);
      INTERACTION_EVENTS.forEach((type) => {
        try {
          win.removeEventListener(type, markTouched);
        } catch {
          // The iframe may already be gone.
        }
      });
    };
  }, []);

  useEffect(() => {
    if (mounted && state === "poster") setState("loading");
  }, [mounted, state]);

  return { mounted, state, touched, frameRef, onFrameLoad };
}
