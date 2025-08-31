import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../global.css";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

export default function MainLayout() {
  const { isLoggedIn } = useAuth();
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Protected guard={!isLoggedIn}>
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
            }}
          ></Stack.Screen>
        </Stack.Protected>
        <Stack.Protected guard={isLoggedIn}>
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          ></Stack.Screen>
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
