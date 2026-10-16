import Landing from "@/components/screens/Landing";
import MarketingLanding from "@/components/screens/MarketingLanding";
import { Platform } from "react-native";

/**
 * `/` for a logged-out visitor. Web shows the public marketing landing; native keeps the brand
 * hero + inline login (`Landing`) as the first screen, unchanged.
 *
 * This uses `Platform.OS === "web"` instead of a `.web.tsx` platform extension on purpose: this
 * project's single `jest-expo` Jest config resolves one platform for every test file, so a
 * `HomeEntry`/`HomeEntry.web` split would never let a web-targeted test actually exercise the web
 * branch without a second Jest project. The runtime behavior is identical either way.
 */
export default function LandingPage() {
  if (Platform.OS === "web") {
    return <MarketingLanding />;
  }
  return <Landing />;
}
