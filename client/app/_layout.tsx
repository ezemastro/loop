import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../global.css";

const queryClient = new QueryClient();

export default function _layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack></Stack>
    </QueryClientProvider>
  );
}
