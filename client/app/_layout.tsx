import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api/queryClient";
import { useEffect } from "react";
import { Platform } from "react-native";
import "../global.css";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSessionStore } from "@/stores/session";
import { configureGoogleSignIn } from "@/services/googleOauth";
import { ToastProvider } from "@/components/ToastProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import ThemeProvider from "@/components/ThemeProvider";

export default function RootLayout() {
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
              </Stack>
              <PwaInstallPrompt />
            </ToastProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
