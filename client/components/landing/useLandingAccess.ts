import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { landingEnterHref } from "@/services/sessionRestore";
import { useSessionStore } from "@/stores/session";

export type LandingAccess = {
  signedIn: boolean;
  /** Where "Ingresar" leads: the sign-in screen, or straight into the app when already signed in. */
  enterHref: ReturnType<typeof landingEnterHref>;
};

/**
 * What the landing knows about the visitor. `/` is pre-rendered signed out and always stays
 * public, so the first client render must match that markup (React hydration error #418/#425):
 * the signed-in variant only shows after the first commit.
 */
export function useLandingAccess(): LandingAccess {
  const { isLoggedIn } = useAuth();
  const hasAcceptedTerms = useSessionStore((state) => state.hasAcceptedTerms);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const signedIn = mounted && isLoggedIn;
  return { signedIn, enterHref: landingEnterHref({ isLoggedIn: signedIn, hasAcceptedTerms }) };
}
