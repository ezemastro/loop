# Store Listing — URLs and Data Safety Answers

Task 6.4. Filled in with the exact URLs this change makes reachable. `client/app.json`'s Expo SDK
54 config schema has **no** `privacyPolicyUrl`/`termsOfServiceUrl`-style key (checked against
`@expo/config-types/build/ExpoConfig.d.ts` — task 6.2 explicitly forbids inventing one), so these
URLs are pasted by hand into each store console instead.

**Do not submit to either store until task 6.6 (legal review sign-off) is complete.** The pages
these URLs point to currently carry a visible `REVISIÓN LEGAL PENDIENTE` marker.

## URLs to paste

| Field | URL |
|---|---|
| Privacy Policy URL (App Store Connect, Play Console) | `https://loop.reditinere.com/privacidad` |
| Account/Data Deletion URL (Play Console "Data safety") | `https://loop.reditinere.com/borrar-cuenta` |
| Terms of Service / EULA (optional, App Store Connect) | `https://loop.reditinere.com/terminos` |

If deploying to a different host, substitute `EXPO_PUBLIC_LEGAL_BASE_URL` (see
`client/config.ts`, `LEGAL_BASE_URL`) for `https://loop.reditinere.com`.

## Google Play "Data safety" section — what the template answers

Once the placeholders in `client/content/legal/privacyPolicy.ts` are filled and signed off
(task 6.6), the Data Safety questionnaire maps to it as follows. **Values below are placeholders,
not final answers — copy from the reviewed policy once it exists, not from this table.**

| Play Data Safety question | Answered by placeholder |
|---|---|
| What data does your app collect? | `{{DATOS_RECOLECTADOS}}` |
| Why do you collect this data? | `{{FINALIDAD}}` |
| Is data collection based on consent / legal basis? | `{{BASE_LEGAL}}` |
| How long is data retained? | `{{CONSERVACION}}` |
| Is data shared with third parties? | `{{TERCEROS}}` |
| Does your app target or is likely to be accessed by children? | `{{MENORES}}` — mandatory, see below |
| Can users request data access/deletion? | `{{DERECHOS}}` + the `/borrar-cuenta` URL above |
| Contact for privacy questions | `{{CONTACTO}}` |
| Governing jurisdiction | `{{JURISDICCION}}` |

### `{{MENORES}}` is the release blocker inside the release blocker

Loop's users are school families — Play's "Families" and "target age" declarations, and Apple's
equivalent age-rating questions, both depend directly on this placeholder. Submitting either store
listing with `{{MENORES}}` unfilled is not just incomplete copy, it is very likely to fail store
review on its own, independent of task 6.6's general gate.

## Account deletion flow (Play requirement, already satisfied)

Google requires either an in-app deletion path or an in-app link to a web deletion path. Both
exist:

- In-app: `Settings` → `Eliminar cuenta` (authenticated, immediate, `DELETE /me`).
- Web, no login required: `/borrar-cuenta` (this change), linked from the account-deletion field
  above and reachable directly.
