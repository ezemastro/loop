/**
 * Shared shape for the legal documents (`privacyPolicy.ts`, `termsDocument.ts`) and the in-app
 * Terms screen (`components/screens/Terms.tsx`), which reused this exact shape locally before
 * this module existed.
 */
export type LegalSectionType = "title" | "subtitle" | "paragraph" | "list-item";

export interface LegalSection {
  type: LegalSectionType;
  content: string;
}
