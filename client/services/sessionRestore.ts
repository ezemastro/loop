/**
 * Pure decision logic for restoring a stored session before the route guard runs.
 *
 * The session store persists the token but not `user` (`stores/session.ts` `partialize`), and the
 * route guard in `app/_layout.tsx` is `isLoggedIn = !!user`. After a reload the guard therefore
 * sees a logged-out session and bounces the URL to `/` before anything can fetch `/me`. This
 * module decides when the navigator must wait instead.
 */

export type RestoreStatus =
  /** Nothing to wait for: render the navigator and let the guard decide. */
  | "ready"
  /** A stored token is being exchanged for a user (`/me`). Render a neutral loading state. */
  | "restoring"
  /** `/me` failed for a reason that is not a verdict on the token (network, 5xx). Offer a retry. */
  | "failed";

export interface RestoreInput {
  /** The component has committed at least once on the client (see `useSessionRestore`). */
  mounted: boolean;
  /** `zustand/persist` finished reading storage. */
  hydrated: boolean;
  /** Routes that must keep the static-export markup and are never worth waiting for. */
  pathname: string;
  isWeb: boolean;
  hasToken: boolean;
  hasUser: boolean;
  query: {
    isError: boolean;
    isFetching: boolean;
    /** Offline: the query wants to run but is paused until the network returns. */
    isPaused: boolean;
  };
}

/**
 * Routes `expo-router`'s static export prerenders with their own markup: the landing and the auth
 * screens. Before the first client commit the root layout must render the navigator for these,
 * because that is exactly what the server rendered (a different first render is hydration error
 * #418/#425). Every other route is prerendered as the logged-out page by accident, so a spinner is
 * both correct and an improvement there.
 */
const PRERENDERED_PATHS = new Set([
  "/",
  "/ingresar",
  "/login",
  "/register",
  "/schoolSelection",
  "/forgot-password",
  "/reset-password",
]);

/**
 * Public routes reachable with or without a session. They never wait for a restore: the legal
 * pages must stay readable for a store reviewer, and `/demo` logs itself in.
 */
const UNGATED_PATHS = new Set(["/privacidad", "/terminos", "/borrar-cuenta", "/demo"]);

export const isPrerenderedPath = (pathname: string) => PRERENDERED_PATHS.has(pathname);
export const isUngatedPath = (pathname: string) => UNGATED_PATHS.has(pathname);

export const deriveRestoreStatus = (input: RestoreInput): RestoreStatus => {
  const { mounted, hydrated, pathname, isWeb, hasToken, hasUser, query } = input;

  if (isUngatedPath(pathname)) return "ready";

  if (!mounted) {
    // Server render and first client render must match. Native has no prerender.
    return isWeb && isPrerenderedPath(pathname) ? "ready" : "restoring";
  }
  // Storage not read yet, so there is no way to know whether a token exists.
  if (!hydrated) return "restoring";

  if (!hasToken || hasUser) return "ready";

  if (query.isPaused) return "failed";
  if (query.isError && !query.isFetching) return "failed";
  return "restoring";
};

/** Paths a signed-out visitor can be on: the landing, the access screens and the auth flows. */
const OUTSIDE_APP_PATHS = new Set([
  "/",
  "/ingresar",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/schoolSelection",
]);

/**
 * Whether entering the app should land on `/home`. The route guard's own fallback picks whichever
 * `(main)` screen it finds first (it was `/settings`), so the app navigates explicitly when:
 * - the user just got in while the navigator was mounted (login, demo, accepting the terms), or
 * - the app started already signed in from a signed-out path (a reload on `/`, or a native cold
 *   start, whose initial path is `/`).
 * A reload on an in-app path such as `/messages` keeps that path.
 */
export const shouldLandOnHome = (input: {
  wasInside: boolean | null;
  isInside: boolean;
  entryPath: string | null;
}): boolean => {
  if (!input.isInside) return false;
  if (input.wasInside === false) return true;
  return (
    input.wasInside === null && (input.entryPath === null || OUTSIDE_APP_PATHS.has(input.entryPath))
  );
};
