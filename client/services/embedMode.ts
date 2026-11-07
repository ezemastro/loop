import { Platform } from "react-native";

/**
 * True on web when this page loaded directly on the embeddable live-demo route (`/demo`, see
 * `app/demo.tsx`). That route is meant to run inside an `<iframe>` on the marketing landing's hero
 * (`marketing-landing` T7) — same origin, so it shares `localStorage`/`sessionStorage` with the
 * parent page. Everything gated by this flag exists to keep that embed from leaking into, or
 * being confused with, the surrounding page:
 *
 * - `services/secureStorage.ts` / `stores/theme.ts` swap their persisted storage for an in-memory
 *   stand-in (`embed-demo-storage-isolation`), so entering the demo here never persists a session
 *   or theme the parent page (or a later visit to `/`) could pick up.
 * - `components/DemoModeBanner.tsx` hides the "Modo demo" banner until the first interaction.
 * - `app/_layout.tsx` skips mounting `PwaInstallPrompt` (nothing should offer to install the app
 *   from inside a demo preview).
 *
 * The flag is only true when the page is actually framed (`window.self !== window.top`). The landing's
 * "Probá la demo" button opens `/demo` as a top-level page, and there it must behave like the
 * ordinary "Explorar la demo sin crear cuenta" flow: the session survives a reload on `/home`, the
 * banner shows immediately and "Salir" works. Nothing leaks into a parent page when there is none.
 *
 * Read once, synchronously, from `window.location.pathname` at module-evaluation time — this
 * module loads before `expo-router` does, and the embed is always entered through a fresh page
 * load (the iframe's own `src` navigation), never a client-side nav from elsewhere in the app, so
 * there is no later path change for this to miss.
 */
/** True when this page is a child frame. Comparing the two references never throws, even cross-origin. */
const isFramed = () => typeof window !== "undefined" && window.self !== window.top;

export const isEmbedRoute =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  window.location.pathname === "/demo" &&
  isFramed();
