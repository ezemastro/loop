import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { useSelf } from "@/hooks/useSelf";
import { useSessionHydrated, useSessionStore } from "@/stores/session";
import {
  deriveRestoreStatus,
  isSessionSettled,
  type RestoreInput,
  type RestoreStatus,
} from "@/services/sessionRestore";

/**
 * Restores a stored session at the root, outside the route guard.
 *
 * `useSelf` used to run only inside `(main)/(tabs)/_layout.tsx`, which the guard removes whenever
 * `user` is null, so after a reload `user` could never be fetched. Running it here breaks that
 * cycle; the returned status tells the root layout to hold the navigator back (and so keep the
 * reloaded URL) until the token has been exchanged for a user or has been rejected.
 *
 * A 401 never reaches this hook as an error state: the axios interceptor logs out first, which
 * clears the token and turns this into `ready`.
 */
export const useSessionRestore = (): {
  status: RestoreStatus;
  /** The session is resolved for real, even on a public route that rendered before it was. */
  settled: boolean;
  retry: () => Promise<unknown>;
} => {
  const pathname = usePathname();
  const hydrated = useSessionHydrated();
  const hasToken = useSessionStore((state) => !!state.authToken);
  const hasUser = useSessionStore((state) => !!state.user);
  const query = useSelf();

  // False on the server and on the first client render, which must produce identical markup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const input: RestoreInput = {
    mounted,
    hydrated,
    pathname,
    isWeb: Platform.OS === "web",
    hasToken,
    hasUser,
    query: {
      isError: query.isError,
      isFetching: query.isFetching,
      isPaused: query.fetchStatus === "paused" && query.isPending,
    },
  };

  // Returns the refetch so callers (and tests) can wait for the retry to settle.
  return {
    status: deriveRestoreStatus(input),
    settled: isSessionSettled(input),
    retry: () => query.refetch(),
  };
};
