import { Platform } from "react-native";

/**
 * Two separate questions about the live-demo route (`/demo`, see `app/demo.tsx`), read once and
 * synchronously at module evaluation (this module loads before `expo-router`, and `/demo` is
 * always entered through a fresh page load, so there is no later path change to miss).
 *
 * 1. `isDemoBootPath`: did this page load on `/demo`, framed or not? It decides STORAGE. The demo
 *    must never touch the origin's real `localStorage`: a stale `demoMode` would make a later real
 *    login hit the mock adapter, the demo token would overwrite a real persisted `authToken`, and
 *    the theme store would keep demo colours. `services/webStorage.ts` therefore swaps in an
 *    in-memory stand-in whenever this is true (`embed-demo-storage-isolation`). Consequence: a
 *    reload of a top-level demo does not keep the session, and leaves `localStorage` untouched.
 *
 * 2. `isFramedDemo`: is that demo inside an `<iframe>` (the landing hero)? It decides UI only:
 *    - framed: the "Modo demo" banner waits for the first interaction, Home shows only the feed
 *      (real school items first), and `app/_layout.tsx` skips the PWA install prompt;
 *    - top level (the landing's "Probá la demo" button): banner immediately, the normal full demo
 *      Home, same as the "Explorar la demo sin crear cuenta" flow.
 */
export const isDemoBootPath =
  Platform.OS === "web" && typeof window !== "undefined" && window.location.pathname === "/demo";

/** True when this page is a child frame. Comparing the two references never throws, even cross-origin. */
const isFramed = () => typeof window !== "undefined" && window.self !== window.top;

export const isFramedDemo = isDemoBootPath && isFramed();
