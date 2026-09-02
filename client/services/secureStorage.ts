import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { StateStorage } from "zustand/middleware";

/**
 * The legacy plaintext key `zustand/persist` used before this change. Kept as a constant here (not
 * imported from `stores/session.ts`) so this module has no dependency on the store it backs.
 */
const LEGACY_ASYNC_STORAGE_KEY = "session-storage";

/**
 * Read-through migration from the old plaintext `AsyncStorage` entry into `expo-secure-store`.
 * Without this, every existing signed-in user would be logged out on first launch of a build that
 * switches storage backends, because SecureStore starts empty.
 *
 * Runs at most once per install: a hit on SecureStore short-circuits immediately, and a hit on the
 * legacy key writes it forward and deletes the legacy copy, so the next call is a SecureStore hit
 * too. Idempotent by construction.
 */
async function getItemWithMigration(name: string): Promise<string | null> {
  const current = await SecureStore.getItemAsync(name);
  if (current !== null) return current;

  if (name !== LEGACY_ASYNC_STORAGE_KEY) return null;

  const legacy = await AsyncStorage.getItem(LEGACY_ASYNC_STORAGE_KEY);
  if (legacy === null) return null;

  await SecureStore.setItemAsync(name, legacy);
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
  return legacy;
}

/**
 * `expo-secure-store` has no web implementation. On web the browser's own origin isolation is the
 * boundary, so `AsyncStorage` (`localStorage`) is retained there rather than shimmed — a shim that
 * throws would make `zustand/persist` swallow the error and silently degrade to no persistence,
 * logging every web user out on refresh.
 */
export const sessionStorage: StateStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        getItem: (name) => getItemWithMigration(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      };
