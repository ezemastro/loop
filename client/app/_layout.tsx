import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import "../global.css";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSessionStore } from "@/stores/session";
import { configureGoogleSignIn } from "@/services/googleOauth";
import { ToastProvider } from "@/components/ToastProvider";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { isLoggedIn } = useAuth();
  const hasAcceptedTerms = useSessionStore((state) => state.hasAcceptedTerms);

  useEffect(() => {
    configureGoogleSignIn();
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
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
