/**
 * LEGAL-REVIEW-REQUIRED — see `client/content/legal/privacyPolicy.ts`. Renders the
 * structure-only privacy template; the visible `REVISIÓN LEGAL PENDIENTE` marker is part of the
 * document itself (task 2.1), not added separately here, so it survives however the sections are
 * rendered.
 */
import { buildPrivacyPolicySections } from "@/content/legal/privacyPolicy";
import LegalSectionList from "./LegalSectionList";

export default function PrivacyPolicy() {
  return <LegalSectionList title="Política de privacidad" sections={buildPrivacyPolicySections()} />;
}
