import { Stack } from "expo-router";

// `messages` is an 8th tab implemented as a directory (`index` + `[userId]`); without this,
// a throw in a chat row falls through to the root instead of staying contained at tab granularity.
export { TabErrorBoundary as ErrorBoundary } from "@/components/RouteErrorFallback";

export default function MessagesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
