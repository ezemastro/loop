import { Redirect } from "expo-router";
import { Platform } from "react-native";
import Landing from "@/components/screens/Landing";
import MarketingLanding from "@/components/screens/MarketingLanding";
import { useAuth } from "@/hooks/useAuth";
import { useSessionStore } from "@/stores/session";

/**
 * `/`, outside every route guard (a guard that fails removes its screens, which would bounce a
 * signed-in visitor away from the one URL that must always load).
 *
 * - Web: the public marketing landing, for everyone. A signed-in visitor stays on it; its
 *   "Ingresar" and "Crear cuenta" buttons take them into the app (`useLandingAccess`).
 * - Native: the entry screen. Signed out shows the brand hero with its inline login (`Landing`);
 *   signed in goes to the app (the terms screen when they are still pending).
 *
 * This uses `Platform.OS === "web"` instead of a `.web.tsx` platform extension on purpose: this
 * project's single `jest-expo` Jest config resolves one platform for every test file, so a split
 * would never let a web-targeted test exercise the web branch.
 */
export default function RootIndex() {
  const { isLoggedIn } = useAuth();
  const hasAcceptedTerms = useSessionStore((state) => state.hasAcceptedTerms);

  if (Platform.OS === "web") return <MarketingLanding />;
  if (isLoggedIn) return <Redirect href={hasAcceptedTerms ? "/home" : "/terms"} />;
  return <Landing />;
}
