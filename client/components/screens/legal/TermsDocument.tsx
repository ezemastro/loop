/**
 * LEGAL-REVIEW-REQUIRED — see `client/content/legal/termsDocument.ts`. Public, anonymous
 * `/terminos` route. Resolves the community name from `?c=<slug>` through the already-public
 * `GET /communities/:slug`; no slug, or an unknown one, falls back to the neutral label rather
 * than inventing a community (spec `terms-acceptance`, "Public terms without a community use a
 * neutral label", "Unknown slug does not break the page").
 */
import { useLocalSearchParams } from "expo-router";
import { buildTermsSections, NEUTRAL_COMMUNITY_LABEL } from "@/content/legal/termsDocument";
import { useCommunityBySlug } from "@/hooks/useCommunityBySlug";
import LegalSectionList from "./LegalSectionList";

export default function TermsDocument() {
  const { c: slug } = useLocalSearchParams<{ c?: string }>();
  const { data: community, isError } = useCommunityBySlug(slug);

  const communityName =
    community && !isError ? community.name : NEUTRAL_COMMUNITY_LABEL;

  return <LegalSectionList title="Términos y condiciones" sections={buildTermsSections(communityName)} />;
}
