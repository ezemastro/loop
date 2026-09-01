# Proposal: Profile Settings Screen

## Intent

`/profile` currently scatters its account controls. "Cerrar sesión" lives in a pinned bar *outside*
the section `FlatList`; "Eliminar cuenta" lives as a section *inside* the scrolling list. Two
destructive actions, two different layers, both permanently occupying the profile page. The user
asked for a gear icon in `/profile` that opens a settings area, and for those controls to move
inside it — plus a way to report a bug, send a suggestion, or contact the team by mail.

This change is **frontend-only**. Nothing it introduces persists to the account or touches the API.

## Scope

### In Scope

1. **Entry point** — a gear icon in the `/profile` header row, visible only for the current user,
   navigating to a new `/settings` route.
2. **Account & session group** — "Cerrar sesión" and "Eliminar cuenta", relocated out of
   `UserPage.tsx`. The typed-email confirmation for deletion moves with it, unweakened.
3. **Contact group** — three entries (report a bug, send a suggestion, contact us) that open the
   user's mail client addressed to `loop@reditinere.com`, with a Spanish subject and a prefilled
   body carrying app version, platform and current route.
4. A fallback when the mail client cannot be opened, reusing the existing manual-copy pattern.

### Out of Scope — considered and deferred

Every item below was evaluated as a candidate settings group and rejected **for this change**,
because each needs per-account persistence or auth work that does not exist yet. The user
explicitly limited this slice to "cosas que afecten al frontend".

| Deferred | Why it is not frontend-only |
|---|---|
| Notification preferences (push, email, per-category) | Needs a per-account preference record and server-side respect at send time; a local-only toggle would lie to the user |
| Email/marketing preferences | Same, plus legal consent trail |
| Privacy toggles (profile visibility, school visibility) | Enforcement is server-side; a client toggle is cosmetic |
| Blocked users | Needs a block entity, a moderation endpoint and feed filtering |
| Change password / change email | Auth flows with verification and re-authentication |
| Active sessions / sign out everywhere | Needs server-side token revocation |
| Community management (leave/switch) | Touches theme resolution and listing visibility |
| Data export / download my data | Server job plus a delivery channel |
| Appearance, density, language | No dark mode and no i18n layer exists; the app is Spanish-only |

The settings list is designed so each of these lands later as an appended group, not a rewrite.

## Capabilities

### New Capabilities

- `profile-settings`: the settings entry point, the grouped settings list contract, the relocated
  account-and-session actions with their confirmation gate, and the support-mail entries.

### Modified Capabilities

- None. `openspec/specs/` holds no merged spec that this change alters.

## Approach

A real route (`app/(main)/settings.tsx`), not a sheet — the app navigates by routes everywhere
(`listing/`, `user/[userId]`, `offer`, `edit`) and reserves modals for short confirmations. A
declarative group/item table (`SETTINGS_GROUPS`) drives the list, mirroring the `PRIMARY_TABS`
precedent this repo already established and guards with a test. Mail bodies are built by a pure
function so the one thing jest can genuinely assert — that no credential ever reaches an outbound
body — is asserted.

`CONTACT_EMAIL = "loop@reditinere.com"` **already exists** in `client/config.ts` and is already
consumed by `AllowedDomainsNotice.tsx`. No new constant and no new env var: `REPORT_EMAIL`
(`EXPO_PUBLIC_REPORT_EMAIL`, possibly undefined) stays exclusive to abuse reports, which are a
different inbox concern.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `client/app/(main)/settings.tsx` | New | Route file; auto-registered by the existing `(main)` `Stack` |
| `client/components/screens/Settings.tsx` | New | Screen: list, handlers, delete-confirmation modal |
| `client/components/settings/settingsItems.ts` | New | `SETTINGS_GROUPS` declarative table |
| `client/components/settings/SettingsRow.tsx` | New | One pressable row |
| `client/services/supportMail.ts` | New | Pure subject/body builders |
| `client/services/accountDeletion.ts` | New | Pure typed-email confirmation gate |
| `client/hooks/useMailComposer.ts` | New | Shared send + fallback state |
| `client/components/bases/MailFallbackSheet.tsx` | New | Extracted manual-copy sheet |
| `client/components/UserPage.tsx` | Modified | Gear added; logout bar and delete section removed |
| `client/components/ReportButton.tsx` | Modified | Migrated onto the extracted fallback |
| `client/components/Icons.tsx` | Modified | `SettingsIcon` |
| `client/__tests__/` | New | Two pure test files |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Delete-account confirmation weakened by the move | Low | Gate extracted to a pure function and unit-tested; modal copy moved verbatim |
| Gear leaks onto other users' profiles | Med | Rendered under the same `isCurrentUser` guard as the controls it replaces |
| Settings leaks into the tab bar or desktop header | Low | It lives outside `(tabs)/` and is absent from `PRIMARY_TABS`; a test asserts both |
| `ReportButton` regression from the fallback extraction | Med | Pure move; the extraction is the first item to drop if the diff must shrink |
| No component tests exist to catch render regressions | High | Explicit visual readback checklist; no new test apparatus proposed |
| Users lose a one-tap logout they had before | Med | Accepted and intended — this is the consolidation the user asked for |

## Rollback Plan

Additive except for two files. Reverting `UserPage.tsx` restores the pinned logout bar and the
delete section exactly; the new files become dead code and can be deleted independently. The
`ReportButton` extraction reverts on its own.

## Dependencies

- Branch `feat/ui-11-settings`, already checked out.
- `expo-clipboard` and `expo-constants` are existing direct dependencies; no new package.
- Test command is `cd client && npx jest --ci --watchAll=false` (664/664 at baseline). Never
  `npm run test` — it runs `--watchAll` and never terminates.
- `npm run lint` and `npx tsc --noEmit` are broken pre-existing and are not gates.

## Size Forecast and Delivery

Forecast **≈850–950 changed lines** against a 800-line budget, delivery strategy `single-pr`.
This sits at the edge. The mail-fallback extraction (`useMailComposer` + `MailFallbackSheet` +
the `ReportButton` migration, ≈150 lines) is the designated excision: dropping it and inlining a
local fallback in the settings screen brings the diff under budget at the cost of a third copy of
the pattern. Recommend keeping the extraction and accepting a `size:exception`.

## Success Criteria

- [ ] A gear appears in the `/profile` header row and only there — never on `/user/[userId]`.
- [ ] "Cerrar sesión" and "Eliminar cuenta" no longer appear anywhere in `UserPage.tsx`.
- [ ] Deleting an account still requires typing the exact account email before the button enables.
- [ ] All three contact entries open a composer addressed to `loop@reditinere.com`.
- [ ] No prefilled mail body contains a token, an auth header, or the user's email address.
- [ ] Settings appears in neither the bottom tab bar nor the desktop header nav.
- [ ] `npx jest --ci --watchAll=false` passes with the new tests added.
