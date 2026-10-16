import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useSessionStore } from "@/stores/session";
import { useLogin } from "@/hooks/useLogin";
import { DEMO_SHOWCASE_EMAIL } from "@/demo";

/**
 * Embeddable live-demo entry point (`marketing-landing` T7).
 *
 * Contract for whoever embeds this (the landing's hero phone mockup, `components/landing/*` —
 * this file is intentionally the only thing on the app side that route owns):
 * - URL: `/demo`, same origin as the rest of the app. Load it in an `<iframe>` at roughly
 *   390x844 CSS px (phone layout) — see `components/screens/MarketingLanding.tsx`'s phone shell
 *   for the exact chrome the viewport is sized against.
 * - No clicks required: on mount this calls the same entry the "Explorar la demo sin crear
 *   cuenta" link uses (`enterDemoMode()` + login with `DEMO_SHOWCASE_EMAIL`,
 *   `hooks/useLoginForm.ts`) and lands on the home feed (`/(main)/(tabs)/home`).
 * - Isolation: this route runs with in-memory storage, not `localStorage`
 *   (`services/embedMode.ts`, `services/webStorage.ts`) — entering the demo here never persists a
 *   session or theme the parent page could pick up, and reloading `/` afterwards is unaffected.
 * - Embed-only UI changes, all keyed off `services/embedMode.ts`'s `isEmbedRoute` (this route is
 *   the only thing that flag is ever true for): the "Modo demo" banner
 *   (`components/DemoModeBanner.tsx`) stays hidden until the first interaction inside the iframe
 *   (pointerdown/keydown/scroll/touchstart) instead of showing immediately, and the PWA install
 *   prompt never mounts (`app/_layout.tsx`).
 * - No events are posted out of the iframe today; the parent only needs the URL above as `src`.
 *
 * This screen itself renders nothing but a brief loading state — the real content, once logged
 * in, is the ordinary home feed.
 */
export default function DemoEntry() {
  const router = useRouter();
  const { mutate: login } = useLogin();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Order matters here too, same reason as `useLoginForm.ts`'s `loginAsDemo`: demo mode has to
    // be on *before* the login call, or that first request would try to reach the real API.
    useSessionStore.getState().enterDemoMode();
    login(
      { email: DEMO_SHOWCASE_EMAIL, password: "" },
      { onSuccess: () => router.replace("/(main)/(tabs)/home") },
    );
  }, [login, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator />
    </View>
  );
}
