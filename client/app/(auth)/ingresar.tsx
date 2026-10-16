import Landing from "@/components/screens/Landing";

/**
 * Web access screen. On web, `/` renders the marketing landing (`MarketingLanding`), so the old
 * brand-hero-plus-login screen moves here and every "Ingresar" CTA on the marketing page points
 * at this route. Native keeps `Landing` mounted directly at `/` (`HomeEntry`), so this route is
 * reachable there too but is not the native entry point.
 */
export default function IngresarPage() {
  return <Landing />;
}
