# Public Legal Pages Specification

## Purpose

Defines the three legal URLs Loop must expose publicly to be publishable on the App Store and
Google Play, the anonymity guarantee for each, and the limits of the copy they carry. It does not
define the legal content itself — see "Template Status" below.

## Requirements

### Requirement: Anonymous Reachability

The URLs `/privacidad`, `/terminos` and `/borrar-cuenta` MUST be reachable over HTTPS with no
session, no cookie, no `Authorization` header and no prior app install. Each MUST answer HTTP 200.
None of the three MAY be declared inside a `Stack.Protected` block in
`client/app/_layout.tsx` — a failing guard removes the screen from the navigator entirely
(`client/node_modules/expo-router/build/useScreens.js:123`), so a guarded legal route would bounce
a store reviewer to the login screen after hydration.

(Phase 1 — routes and serving layer)

#### Scenario: Store reviewer opens the privacy URL cold

- GIVEN a browser with no cookies, no local storage and no Loop session
- WHEN it requests `https://loop.reditinere.com/privacidad`
- THEN the response is HTTP 200 and the body is the privacy policy page, not the login screen and
  not the landing page

#### Scenario: All three URLs answer anonymously

- GIVEN an anonymous client
- WHEN it requests `/privacidad`, `/terminos` and `/borrar-cuenta` in turn
- THEN each returns HTTP 200 with its own page content

#### Scenario: No legal route sits behind a guard

- GIVEN `client/app/_layout.tsx`
- WHEN the three legal screens are declared
- THEN each `<Stack.Screen>` is a sibling of the existing `debug` screen at `_layout.tsx:93` and
  is not nested inside any `Stack.Protected` element

### Requirement: Server-Agnostic Rendering

Each legal page MUST be delivered as prerendered HTML that carries its own `<title>` and its
principal body text in the raw response, without requiring JavaScript execution to become
meaningful. The serving layer MUST resolve the extensionless URL to that page's prerendered file.

`serve --single` prepends a `**` → `/index.html` rewrite (`serve@14 build/main.js:539-548`) and
`serve-handler` skips `cleanUrls` resolution whenever a rewrite matched
(`serve-handler@6.1.7 src/index.js:282`), so the `-s` flag at `Dockerfile.web:42` MUST be removed
and replaced by an explicit ordered rewrite list.

#### Scenario: Raw HTML carries the page's own title

- GIVEN `curl -sS https://loop.reditinere.com/privacidad` with JavaScript never executed
- WHEN the raw response body is inspected
- THEN it contains the privacy page's own `<title>` and its principal headings, not the
  `dist/index.html` shell's title

#### Scenario: Extensionless URL resolves to the prerendered file

- GIVEN the built web image serving `dist/`
- WHEN `/terminos` is requested
- THEN `dist/terminos.html` is served, not `dist/index.html`

### Requirement: No Regression for Dynamic Routes

Changing the serving configuration MUST NOT break deep links to dynamic routes. The catch-all
`**` → `/index.html` rewrite MUST remain, ordered last, so any path without a matching
prerendered file still falls back to the SPA shell exactly as it does today.

#### Scenario: Listing deep link still resolves

- GIVEN the new serving configuration
- WHEN an anonymous client requests `/listing/<any-uuid>`
- THEN the response is HTTP 200 serving the SPA shell, identical to the pre-change behaviour

#### Scenario: Existing top-level routes are unaffected

- GIVEN the new serving configuration
- WHEN `/`, `/terms` and `/debug` are requested
- THEN each returns HTTP 200 with the same content it returned before the change

### Requirement: Account Deletion Form

`/borrar-cuenta` MUST let an anonymous visitor submit the email address of the account to be
deleted and MUST send it to `POST /me/delete-request`
(`server/api/src/index.ts:72`), which is public by construction. The page MUST report submission
outcome to the user. Because the endpoint always answers 204 to avoid being an email-enumeration
oracle, the page MUST NOT claim the account was found — only that the request was recorded.

#### Scenario: Request is recorded

- GIVEN an anonymous visitor on `/borrar-cuenta` and an existing account `ana@colegio.edu`
- WHEN they submit that address
- THEN `POST /me/delete-request` is called and a `pending` row exists in
  `account_deletion_requests` for that user

#### Scenario: Unknown address is indistinguishable

- GIVEN an anonymous visitor submits an address with no account
- WHEN the response is returned
- THEN the page shows the same confirmation text as for an existing account, and no row is created

#### Scenario: Malformed address gets feedback

- GIVEN a visitor submits `not-an-email`
- WHEN the form validates the input
- THEN the page shows a validation message and does not report the request as recorded

### Requirement: Template Status Is Visible

Until a human has reviewed and signed off the legal copy, every rendered legal page MUST display a
visible `REVISIÓN LEGAL PENDIENTE` marker, and the source modules MUST carry a
`LEGAL-REVIEW-REQUIRED` banner comment. The template MUST expose named placeholders for
`{{DATOS_RECOLECTADOS}}`, `{{FINALIDAD}}`, `{{BASE_LEGAL}}`, `{{CONSERVACION}}`, `{{TERCEROS}}`,
`{{MENORES}}`, `{{DERECHOS}}`, `{{CONTACTO}}`, `{{JURISDICCION}}` and `{{VIGENCIA}}`.

The `{{MENORES}}` placeholder MUST NOT be removed or defaulted to empty: the product is used by
school families, so a minors clause is mandatory.

#### Scenario: Marker is visible before sign-off

- GIVEN the legal copy has not been signed off
- WHEN `/privacidad` renders
- THEN a `REVISIÓN LEGAL PENDIENTE` marker is visible in the page body

#### Scenario: Every placeholder is present

- GIVEN the privacy template module
- WHEN its placeholder keys are enumerated
- THEN all ten named placeholders above are present, and `{{MENORES}}` is non-empty

### Requirement: Copy Register

All user-facing copy on these pages MUST be Rioplatense Spanish using voseo, consistent with the
existing app (`client/components/screens/Landing.tsx:33-44`: `"Publicá"`, `"Ganá loopies"`,
`"Canjeá"`). Tuteo forms MUST NOT be introduced.

#### Scenario: Deletion form uses voseo

- GIVEN the `/borrar-cuenta` page
- WHEN its instructional copy is read
- THEN it uses voseo (for example `"Enviá esta solicitud"`, `"Contanos por qué querés borrar la
  cuenta"`) and contains no tuteo imperative such as `"Cuéntanos"`
