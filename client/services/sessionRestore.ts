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
const UNGATED_PATHS = new Set([
  "/privacidad",
  "/terminos",
  "/borrar-cuenta",
  "/demo",
  "/changelog",
]);

export const isPrerenderedPath = (pathname: string) => PRERENDERED_PATHS.has(pathname);
/**
 * `/` is public on web only: it is the marketing landing, always reachable, signed in or not.
 * On native `/` is the entry point of the app and still waits for the restore.
 */
export const isUngatedPath = (pathname: string, isWeb = false) =>
  UNGATED_PATHS.has(pathname) || (isWeb && pathname === "/");

/** The restore outcome once the client has mounted, ignoring any route that skips the wait. */
const resolveSession = (input: RestoreInput): RestoreStatus => {
  const { hydrated, hasToken, hasUser, query } = input;
  // Storage not read yet, so there is no way to know whether a token exists.
  if (!hydrated) return "restoring";

  if (!hasToken || hasUser) return "ready";

  if (query.isPaused) return "failed";
  if (query.isError && !query.isFetching) return "failed";
  return "restoring";
};

export const deriveRestoreStatus = (input: RestoreInput): RestoreStatus => {
  const { mounted, pathname, isWeb } = input;

  if (isUngatedPath(pathname, isWeb)) return "ready";

  if (!mounted) {
    // Server render and first client render must match. Native has no prerender.
    return isWeb && isPrerenderedPath(pathname) ? "ready" : "restoring";
  }
  return resolveSession(input);
};

/**
 * Whether the stored session has been resolved for real (storage read, token exchanged or
 * dropped), whichever route is showing. `deriveRestoreStatus` says "ready" at once on the public
 * routes so they paint without a spinner, which is too early to decide where a person belongs.
 */
export const isSessionSettled = (input: RestoreInput): boolean =>
  input.mounted && resolveSession(input) === "ready";

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
 * - the app started already signed in from a signed-out path (a reload on `/ingresar`, or a native
 *   cold start, whose initial path is `/`).
 * A reload on an in-app path such as `/messages` keeps that path, and so does a reload on the web
 *   landing at `/`, which is always public.
 */
export const shouldLandOnHome = (input: {
  wasInside: boolean | null;
  isInside: boolean;
  entryPath: string | null;
  /** Web keeps a signed-in visitor on the landing at `/`; native has no landing there. */
  isWeb?: boolean;
}): boolean => {
  if (!input.isInside) return false;
  if (input.wasInside === false) return true;
  if (input.wasInside !== null) return false;
  if (input.isWeb && input.entryPath === "/") return false;
  return input.entryPath === null || OUTSIDE_APP_PATHS.has(input.entryPath);
};

/**
 * Where the landing's "Ingresar" leads: the sign-in screen for a signed-out visitor, straight into
 * the app for a signed-in one, and the terms screen when they have not accepted them yet (`/home`
 * does not exist for them, the route guard removes it).
 */
export const landingEnterHref = (input: {
  isLoggedIn: boolean;
  hasAcceptedTerms: boolean;
}): "/ingresar" | "/home" | "/terms" => {
  if (!input.isLoggedIn) return "/ingresar";
  return input.hasAcceptedTerms ? "/home" : "/terms";
};
