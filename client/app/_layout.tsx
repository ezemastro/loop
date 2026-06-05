import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

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
              <Stack.Screen name="debug" />
            </Stack>
            <PwaInstallPrompt />
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
