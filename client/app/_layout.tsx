import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../global.css";
import { useAuth } from "@/hooks/useAuth";
import { SafeAreaProvider } from "react-native-safe-area-context";

const queryClient = new QueryClient();

export default function MainLayout() {
  const { isLoggedIn } = useAuth();
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!isLoggedIn}>
            <Stack.Screen name="(auth)"></Stack.Screen>
          </Stack.Protected>
          <Stack.Protected guard={isLoggedIn}>
            <Stack.Screen name="(main)"></Stack.Screen>
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
