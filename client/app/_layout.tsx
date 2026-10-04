import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api/queryClient";
import { useEffect } from "react";
import { Platform } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import "../global.css";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSessionStore } from "@/stores/session";
import { configureGoogleSignIn } from "@/services/googleOauth";
import { ToastProvider } from "@/components/ToastProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import ThemeProvider from "@/components/ThemeProvider";
import { isEmbedRoute } from "@/services/embedMode";

// Last net for a render-phase throw not contained by a tab-level boundary; navigation itself may
// be dead here, so its escape reloads the app instead of navigating (client-render-error-containment).
export { AppErrorBoundary as ErrorBoundary } from "@/components/RouteErrorFallback";

/**
 * Registers the icon fonts used everywhere (`components/Icons.tsx`) **synchronously during
 * render**, not in an effect (react-hydration-mismatch-icon-fonts).
 *
 * `@expo/vector-icons` renders an empty `<Text />` until `Font.isLoaded(fontFamily)` is true, and
 * only calls `Font.loadAsync` from its own `componentDidMount` — which never runs during
 * `expo-router`'s static web export (`ReactDOMServer.renderToString` doesn't run effects). So the
 * exported HTML always has every icon empty, while the client's first commit can already see a
 * font as loaded (e.g. another icon's effect having fired first) — a genuine content+style
 * mismatch React flags as hydration error #418.
 *
 * Calling `Feather.loadFont()` / `Ionicons.loadFont()` here (top of the root layout, plain
 * function calls, not `useEffect`) runs before any `Icon` descendant constructs, on **both**
 * sides: server-side it synchronously registers the font into `expo-font`'s per-route
 * `serverContext` (reset per route by `expo-router`, so this must re-run on every render, not
 * once at module scope); client-side it synchronously injects the `@font-face` `<style>` tag
 * (idempotent — a no-op once already present). Icons render identically from the very first paint
 * on both sides, so there's nothing left to swap in after mount.
 */
const preloadIconFonts = () => {
  void Feather.loadFont();
  void Ionicons.loadFont();
};

export default function RootLayout() {
  preloadIconFonts();
  const { isLoggedIn } = useAuth();
  const hasAcceptedTerms = useSessionStore((state) => state.hasAcceptedTerms);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/manifest.json";
      document.head.appendChild(link);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const appleMeta = document.createElement("meta");
      appleMeta.name = "apple-mobile-web-app-capable";
      appleMeta.content = "yes";
      document.head.appendChild(appleMeta);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const appleTitle = document.createElement("meta");
      appleTitle.name = "apple-mobile-web-app-title";
      appleTitle.content = "Loop";
      document.head.appendChild(appleTitle);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const appleStatusBar = document.createElement("meta");
      appleStatusBar.name = "apple-mobile-web-app-status-bar-style";
      appleStatusBar.content = "default";
      document.head.appendChild(appleStatusBar);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      appleIcon.href = "/icons/apple-touch-icon.png";
      document.head.appendChild(appleIcon);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("SW registration failed:", err);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          {/* Por fuera del Stack para que todas las pantallas hereden las variables de color. */}
          <ThemeProvider>
            <ToastProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Protected guard={!isLoggedIn}>
                  <Stack.Screen name="(auth)"></Stack.Screen>
                </Stack.Protected>
                <Stack.Protected guard={isLoggedIn}>
                  <Stack.Protected guard={hasAcceptedTerms}>
                    <Stack.Screen name="(main)"></Stack.Screen>
                  </Stack.Protected>
                  <Stack.Protected guard={!hasAcceptedTerms}>
                    <Stack.Screen
                      name="terms"
                      options={{
                        statusBarStyle: "dark",
                      }}
                    />
                  </Stack.Protected>
                </Stack.Protected>
                {/* Dumps the whole user object as JSON — `__DEV__` is a literal Metro replaces at
                    build time, so this branch is statically dead in every production build. */}
                <Stack.Protected guard={__DEV__}>
                  <Stack.Screen name="debug" />
                </Stack.Protected>
                {/*
                  Public legal routes (ADM-01 / PROD-05, `legal-public-routes`). MUST NOT sit
                  inside ANY `Stack.Protected` — not even a `guard={true}` one: a failing guard
                  removes the screen from the navigator entirely
                  (`expo-router/build/useScreens.js`), which would bounce an anonymous store
                  reviewer to the login screen after hydration. These three are siblings of the
                  root `<Stack>` itself, unlike `debug` above (which is intentionally gated).
                */}
                <Stack.Screen name="privacidad" options={{ statusBarStyle: "dark" }} />
                <Stack.Screen name="terminos" options={{ statusBarStyle: "dark" }} />
                <Stack.Screen name="borrar-cuenta" options={{ statusBarStyle: "dark" }} />
                {/*
                  Embeddable live-demo entry point (marketing-landing T7, see app/demo.tsx). Same
                  reason as the legal routes above: it must boot demo mode and reach the home feed
                  for a logged-out visitor, so it cannot sit inside a Stack.Protected guard.
                */}
                <Stack.Screen name="demo" options={{ headerShown: false }} />
              </Stack>
              {/* Nothing should offer to install the PWA from inside the embeddable live-demo
                  route (marketing-landing T7) — see services/embedMode.ts. */}
              {!isEmbedRoute && <PwaInstallPrompt />}
            </ToastProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
