import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../global.css";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSessionStore } from "@/stores/session";

const queryClient = new QueryClient();

export default function RootLayout() {
  const { isLoggedIn } = useAuth();
  const hasAcceptedTerms = useSessionStore((state) => state.hasAcceptedTerms);
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <SafeAreaProvider>
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
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
