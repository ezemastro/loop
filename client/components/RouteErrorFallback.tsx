import { Pressable, Text, View } from "react-native";
import { router, type ErrorBoundaryProps } from "expo-router";
import Error from "@/components/Error";
import { queryClient } from "@/api/queryClient";
import { reloadApp } from "@/services/reloadApp";

type RouteErrorFallbackProps = ErrorBoundaryProps & { escape: "home" | "reload" };

// Canonical home href restated as a local literal (matches `primaryTabs.ts:34`) instead of
// importing `PRIMARY_TABS`, which would drag `@expo/vector-icons` into a component that must stay
// context-free and as small as possible (design.md D3).
const HOME_HREF = "/(main)/(tabs)/home";

/**
 * Shared error boundary fallback. Rendered by `expo-router`'s `Try` with exactly
 * `{ error, retry }` — this component MUST NOT read any React context, because the root site
 * (`app/_layout.tsx`) renders it *above* `QueryClientProvider`, `SafeAreaProvider`, `ThemeProvider`,
 * `GestureHandlerRootView` and `ToastProvider` (design.md, "Verified Facts"). `queryClient` is
 * therefore imported as a module singleton, never via `useQueryClient()`, and navigation uses the
 * imperative `router` export rather than `useRouter()` -- that hook reads `PreviewRouteContext`
 * through `use()`, which is a context read even though it defaults to `undefined` and never throws.
 * Zero context reads is a property worth keeping literally true here, not approximately true.
 *
 * A boundary only catches render-phase throws — not event handlers, effects, or rejected promises
 * (see `client-render-error-containment` spec, "Boundaries Catch Render-Phase Throws Only").
 */
export function RouteErrorFallback({ error, retry, escape }: RouteErrorFallbackProps) {
  const handleRetry = async () => {
    // Unfiltered: the subtree that threw is already unmounted by the time this fallback is on
    // screen, so its query has zero observers and `{ type: "active" }` would provably skip it —
    // that would ship the exact retry loop this reset exists to prevent (design.md D2).
    // The reset is synchronous; its returned promise only tracks refetching still-mounted
    // observers elsewhere, so it is not awaited here. This runs in an event handler, which no
    // boundary catches, so a rejection must be swallowed explicitly.
    queryClient.resetQueries().catch(() => {});
    await retry();
  };

  const handleEscape = () => {
    if (escape === "home") {
      router.replace(HOME_HREF);
      return;
    }
    // Navigation itself may be broken when this is the root boundary, so the escape reloads the
    // whole app instead (design.md D3).
    void reloadApp();
  };

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6">
      {/*
        `Error` renders its children inside a single `<Text>`, so it takes a string, not structured
        content. Nesting the dev detail inside it would make it an inline run on native, where a
        nested `<Text>` is inline and `mt-2` would not apply. The detail is a sibling instead.
      */}
      <Error textClassName="text-center text-lg font-medium">Algo salió mal</Error>
      {__DEV__ ? <Text className="text-center text-sm text-main-text">{error.message}</Text> : null}
      <View className="flex-row gap-2">
        <Pressable
          onPress={handleRetry}
          className="rounded-lg bg-primary px-3 py-1.5 active:opacity-70"
        >
          <Text className="font-semibold text-white">Reintentar</Text>
        </Pressable>
        <Pressable
          onPress={handleEscape}
          className="rounded-lg bg-primary px-3 py-1.5 active:opacity-70"
        >
          <Text className="font-semibold text-white">
            {escape === "home" ? "Ir al inicio" : "Recargar la app"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Tab-level boundary: escapes to the home tab. Used by the 7 single-file tabs + `messages`. */
export function TabErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} escape="home" />;
}

/**
 * Root and home-tab boundary: escapes by reloading the app. Used at `app/_layout.tsx` (last net,
 * navigation may itself be dead) and at the home tab, where `router.replace` to the route you are
 * already on would be a no-op escape (design.md D3).
 */
export function AppErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorFallback {...props} escape="reload" />;
}
