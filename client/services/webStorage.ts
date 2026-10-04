import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";
import { isEmbedRoute } from "./embedMode";

/**
 * In-memory stand-in for `AsyncStorage`'s `StateStorage` shape: nothing ever touches disk, nothing
 * survives a reload, and nothing is visible outside this page's JS heap — in particular, not to
 * any other page sharing this origin's real `localStorage` (`embed-demo-storage-isolation`).
 */
const memory = new Map<string, string>();
const memoryStorage: StateStorage = {
  getItem: (name) => Promise.resolve(memory.get(name) ?? null),
  setItem: (name, value) => {
    memory.set(name, value);
    return Promise.resolve();
  },
  removeItem: (name) => {
    memory.delete(name);
    return Promise.resolve();
  },
};

/**
 * The backing store for every zustand `persist` that writes to `localStorage` on web
 * (`AsyncStorage`'s web implementation: `services/secureStorage.ts`'s session store, and
 * `stores/theme.ts`). On the embeddable live-demo route (`/demo`, `embed-demo-storage-isolation`)
 * this swaps to `memoryStorage` so the iframe's demo session and theme never touch the origin's
 * real `localStorage` — the parent landing page (and a later, non-embedded visit to `/`) must
 * never see them. Everywhere else this is a plain passthrough to `AsyncStorage`, identical to
 * before this module existed.
 */
export const webStorage: StateStorage = isEmbedRoute ? memoryStorage : AsyncStorage;
