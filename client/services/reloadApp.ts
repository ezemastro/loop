import { Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Platform-branched full app reload, used as the "reload" escape route from an error boundary
 * fallback. Kept in its own module (rather than inline in the fallback) so it is a single mock
 * seam that keeps `expo-updates` out of the fallback's own tests (design.md D3).
 */
export async function reloadApp(): Promise<void> {
  if (Platform.OS === "web") {
    window.location.reload();
    return;
  }
  // Native: `Updates.reloadAsync()` restarts the JS bundle, which also drops the in-memory query
  // cache. It throws in `__DEV__` and when updates are disabled; there is no safe native fallback,
  // and retry is still on screen, so the failure is swallowed rather than re-thrown.
  try {
    await Updates.reloadAsync();
  } catch {
    // Intentionally swallowed — see comment above.
  }
}
