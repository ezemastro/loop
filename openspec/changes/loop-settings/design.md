# Design: Profile Settings Screen

## Technical Approach

A new route `app/(main)/settings.tsx` renders `components/screens/Settings.tsx`, which maps a
declarative `SETTINGS_GROUPS` table to rows and owns the handlers that need component state
(logout, delete confirmation, mail fallback). Two pure modules carry the logic worth testing:
`services/supportMail.ts` builds subjects and bodies, `services/accountDeletion.ts` owns the
confirmation gate. `UserPage.tsx` loses both destructive controls and gains a gear.

## Verified Facts

Read in this repository, not assumed. They decide four questions below.

| Fact | Evidence |
|---|---|
| `CONTACT_EMAIL = "loop@reditinere.com"` already exists and is already consumed | `client/config.ts:56`, `AllowedDomainsNotice.tsx:13,33` |
| `(main)/_layout.tsx` renders a bare `<Stack>` with **no** `Stack.Screen` entries — file routes auto-register | `client/app/(main)/_layout.tsx:34` |
| The authenticated subtree sits behind `<Stack.Protected guard={isLoggedIn}>` | `client/app/_layout.tsx:80-92` |
| `useDeleteAccount.onSuccess` calls `logout()` | `client/hooks/useDeleteAccount.ts:23-25` |
| `ReportButton`'s fallback sheet has the `CustomButton`-in-`flex-row` sliver bug on its first button (`className="flex-1"`, no `w-auto max-w-none`) | `ReportButton.tsx:151-159` vs `CustomButton.tsx:12-17` |
| No `@testing-library/react-native`; the six existing test files are pure Node + `fs` | `client/package.json`, `client/__tests__/` |
| `expo-clipboard` and `expo-constants` are already direct dependencies | `client/package.json:36-37` |

Consequence of facts 2 and 3: adding the route costs **zero layout edits**, and ending the session
unmounts the settings screen automatically. No manual `router.replace` after logout or deletion.

## Architecture Decisions

### D1 — A route, not a sheet

| Option | Tradeoff | |
|---|---|---|
| Route `app/(main)/settings.tsx` | Back gesture, web back button, deep link, room to grow | **Chosen** |
| Bottom sheet from the gear | No route, no web back, and a growing list becomes a scroller inside an overlay | Rejected |
| A sixth tab | Settings is not primary navigation | Rejected |

Every non-tab destination in this app is already a route (`listing/[listingId]`, `user/[userId]`,
`offer`, `edit`). Modals here are short confirmations (`DonateModal`, the delete modal), never
navigation targets. The deferred groups will roughly triple the list, so the sheet fails first.

**Registration mechanism.** `href: null` is a `Tabs`-only device for excluding a file that lives
*under* `(tabs)/` from the bar. Settings lives under `(main)/` as a sibling of `user/` and
`listing/`, so it never enters the tab navigator and `href: null` is inapplicable. Absence from
`PRIMARY_TABS` keeps it out of the desktop header too, since that array is the single source both
navigations render from.

### D2 — The delete confirmation moves whole, and its gate becomes testable

The `CustomModal` block (`UserPage.tsx:298-348`) moves verbatim into `Settings.tsx`: same copy,
same `TextInput`, same `placeholder={user.email}`, same `useDeleteAccount`, same clear-on-close.
Nothing about the gate is relaxed by the move.

What changes is that the inline predicate `deleteEmailConfirm !== user.email || isDeleting` becomes
a named pure function, so the only thing standing between a tap and an irreversible action is
asserted by jest rather than trusted from a JSX read:

```ts
// client/services/accountDeletion.ts
export function canConfirmAccountDeletion(
  typed: string, accountEmail: string, isDeleting: boolean,
): boolean {
  return !isDeleting && typed === accountEmail && accountEmail.length > 0;
}
```

Strict `===`, deliberately: trimming or case-folding would *loosen* an irreversible gate, and this
change has no mandate to do that. The `accountEmail.length > 0` clause is new — it closes the case
where a user record without an email would let an empty field match.

### D3 — Declarative groups, handlers stay in the screen

`components/settings/settingsItems.ts` holds presentation and intent; the screen holds behaviour.
This mirrors `primaryTabs.ts`, the pattern this repo already established and guards.

```ts
export type SettingsAction =
  | { kind: "logout" }
  | { kind: "deleteAccount" }
  | { kind: "mail"; template: SupportMailTemplate };

export interface SettingsItem {
  key: string;
  label: string;                       // Spanish UI copy
  description?: string;
  Icon: ComponentType<Partial<IconProps<string>>>;
  variant?: "default" | "destructive";
  action: SettingsAction;
}
export interface SettingsGroup { key: string; title: string; items: SettingsItem[] }
export const SETTINGS_GROUPS: SettingsGroup[] = [ /* cuenta, contacto */ ];
```

`Settings.tsx` renders groups with `.map()` inside a `ScrollView` — not a `FlatList`. The list is
about ten static rows; virtualization buys nothing and a `FlatList` would force the group titles
into a section-header dance. `MainView` + `pageContentClassName("narrow", "p-4 gap-6")` own the
width, matching `UserPage`'s own choice; no page-level `max-w-*` is written outside `MainView`.

Adding a deferred group later is: append a `SettingsGroup`, add one `action.kind` and one `case`.
Additive, per the spec's requirement.

**Rejected**: putting handler functions in the table. `logout`, the delete modal and the fallback
sheet all need component state, so the table would have to become a factory taking a context
object — indirection with no payoff at this size.

### D4 — Three contact entries, one pure body builder

| Row label (Spanish) | Subject | Body shape |
|---|---|---|
| `Reportar un error` | `Loop — Reporte de error` | greeting, `Qué pasó:`, `Qué esperabas:`, `Pasos para reproducir:`, blank area, diagnostics |
| `Enviar una sugerencia` | `Loop — Sugerencia` | greeting, `Tu sugerencia:`, blank area, diagnostics |
| `Contactar con el equipo` | `Loop — Consulta` | greeting, `Tu mensaje:`, blank area, diagnostics |

```ts
// client/services/supportMail.ts
export type SupportMailTemplate = "bug" | "suggestion" | "contact";
export interface SupportMailContext { version: string; platform: string; route: string }
export function buildSupportMail(
  template: SupportMailTemplate, context: SupportMailContext,
): { subject: string; body: string };
```

The diagnostic block is a fixed three-line `--- Datos técnicos ---` footer: `Versión`
(`Constants.expoConfig?.version ?? "desconocida"` — not a `package.json` import, which bundles
fragilely), `Plataforma` (`Platform.OS`), `Pantalla` (`usePathname()`). Honest caveat: originating
from settings, `Pantalla` is always `/settings`; it earns its place only once a contact entry is
surfaced elsewhere, and it costs one line. `SupportMailContext` is a closed three-field type, so
there is no field through which a token, header or user email could reach a body — the leak
prevention is structural, and the test asserts it rather than hoping.

Recipient is `CONTACT_EMAIL`. `REPORT_EMAIL` is deliberately not reused: it is an
`EXPO_PUBLIC_REPORT_EMAIL` env var that may be undefined (`ReportButton.tsx:106-110` already has a
"no configured address" branch because of it), and abuse reports are a different inbox concern. A
hardcoded constant that already exists beats a possibly-undefined env var for a control the user
asked to always work.

### D5 — One mail fallback, extracted rather than copied a third time

Two fallbacks exist today: `ReportButton`'s Alert → selectable-text sheet + `Share` (preserves a
long body) and `AllowedDomainsNotice`'s Alert → `Clipboard` copy of the bare address (no body to
preserve). Settings mails carry a body, so they need the first. Rather than a third copy:

```
services/emailComposer.ts  openMailComposer(to, subject, body) → boolean
        ▲
hooks/useMailComposer.ts   sendMail(to, subject, body)
        │                    └─ false → Alert("Copiar manual" | "Compartir texto" | "Cerrar")
        │                                 └─ setManualCopyText(...)
        ├──→ components/bases/MailFallbackSheet.tsx   <MailFallbackSheet text onClose />
        ├──→ ReportButton.tsx       (migrated; ~50 inline lines deleted)
        └──→ screens/Settings.tsx   (new consumer)
```

`AllowedDomainsNotice` is intentionally **not** migrated: copying a bare address is proportional
there and forcing it through a body-preserving sheet would be a regression in ceremony.

The extraction fixes the sliver bug in passing: the sheet's action row gets
`w-auto max-w-none flex-1` on **both** buttons, not just the second.

### D6 — Gear placement

`UserPage.tsx`'s `header` section is already `flex-row items-center justify-between` holding
`BackButton` on the left and `ReportButton` on the right. The gear takes the right slot under
`isCurrentUser` — mutually exclusive with `ReportButton`'s `!isCurrentUser`, so the row never holds
both and needs no layout change. It follows `BackButton`'s shape: a `Pressable` with `p-1` and
`hitSlop={10}` wrapping a new `SettingsIcon` (`Feather` `settings`, matching the file's dominant
`Feather` pattern), not a `CustomButton` — so the `w-auto max-w-none` rule does not arise here.

## Data Flow

```
UserPage (isCurrentUser) ──gear──→ /settings
                                      │
      SETTINGS_GROUPS ────map────→ Settings.tsx ──switch(action.kind)──┐
                                      │                                │
   ┌──────────────────────────────────┼────────────────────┬───────────┤
   │ "logout"                         │ "deleteAccount"    │ "mail"    │
   ▼                                  ▼                    ▼           │
useSessionStore.logout()      CustomModal + TextInput   buildSupportMail(template, ctx)
   │                            canConfirmAccountDeletion()      │
   │                                  │                          ▼
   │                            useDeleteAccount() ──onSuccess──→ useMailComposer.sendMail
   │                                  │                          │  CONTACT_EMAIL
   └──────────────┬───────────────────┘                          ├─ true  → composer opens
                  ▼                                              └─ false → MailFallbackSheet
       Stack.Protected guard={isLoggedIn} flips
                  ▼
       (main) unmounts → (auth)   [no manual navigation]
```

## File Changes

| File | Action | Description |
|---|---|---|
| `client/app/(main)/settings.tsx` | Create | Route file; renders `<Settings />`. No layout edit needed (fact 2) |
| `client/components/screens/Settings.tsx` | Create | Groups, handler switch, delete modal, fallback sheet |
| `client/components/settings/settingsItems.ts` | Create | `SETTINGS_GROUPS` (D3) |
| `client/components/settings/SettingsRow.tsx` | Create | Pressable row: icon, label, description, destructive variant |
| `client/services/supportMail.ts` | Create | `buildSupportMail` (D4) |
| `client/services/accountDeletion.ts` | Create | `canConfirmAccountDeletion` (D2) |
| `client/hooks/useMailComposer.ts` | Create | Send + fallback state (D5) |
| `client/components/bases/MailFallbackSheet.tsx` | Create | Extracted sheet, sliver bug fixed (D5) |
| `client/components/Icons.tsx` | Modify | `SettingsIcon` — `Feather` `settings` |
| `client/components/UserPage.tsx` | Modify | Gear in header; delete `delete-account` section, the pinned logout bar, the delete modal, and now-unused imports/state |
| `client/components/ReportButton.tsx` | Modify | Migrate onto `useMailComposer` + `MailFallbackSheet` |
| `client/__tests__/settings.test.ts` | Create | Table integrity, deletion gate, source guards |
| `client/__tests__/support-mail.test.ts` | Create | Subjects, diagnostics, credential-leak guard |

`primaryTabs.ts`, `(tabs)/_layout.tsx`, `(main)/_layout.tsx` and `Header.tsx` are **not** modified.
That is the point of D1's registration argument.

## Testing Strategy

Honest scope. `@testing-library/react-native` is not installed and this change does not propose
installing it — a rendering apparatus introduced for one screen is an apparatus nobody maintains.
So jest asserts the pure logic and the invariants that rot silently; everything visual is read back
by hand.

| Layer | What | Approach |
|---|---|---|
| Unit (pure) | Deletion gate | Table test on `canConfirmAccountDeletion`: exact match true; empty, different address, case variant, whitespace-padded, and `isDeleting=true` all false; empty `accountEmail` false |
| Unit (pure) | Mail subjects | Each of the three templates yields its exact Spanish subject; the three subjects are distinct |
| Unit (pure) | Mail bodies | Each body contains version, platform and route, and a blank writing area |
| Unit (pure) | Credential-leak guard | Body matched against an email regex — only `loop@reditinere.com` may appear; body contains none of `token`, `Bearer`, `authorization`, `Authorization` (case-insensitive) |
| Unit (pure) | Table integrity | Unique group and item keys; every label non-empty; exactly two groups; only the deletion row is `destructive`; every `kind: "mail"` template is a valid `SupportMailTemplate` |
| Source guard (`fs`) | The move actually happened | `UserPage.tsx` no longer contains `Cerrar sesión`, `Eliminar cuenta`, `useDeleteAccount`, or `CustomModal` |
| Source guard (`fs`) | Nav isolation | `PRIMARY_TABS` still has exactly five keys and none is `settings`; `(tabs)/_layout.tsx` contains no `settings` screen |
| Source guard (`fs`) | Native display trap | No `hidden ` followed by a display-restoring prefix in the new files (reuses `walkTsFiles`) |
| Regression | Existing 664 tests | `cd client && npx jest --ci --watchAll=false`. Never `npm run test` (`--watchAll`, never terminates) |
| Visual readback | Everything a renderer would assert | See checklist below |

Readback checklist (what jest structurally cannot reach): gear present on `/profile` and absent on
`/user/[userId]`; gear does not disturb the header row when `BackButton` is also present; back from
settings returns to profile on web and native; both groups render with Spanish titles; the delete
modal opens, stays disabled until the exact email is typed, and clears on reopen; logout from
settings lands in `(auth)`; each of the three contact rows opens a composer to
`loop@reditinere.com` on web (Gmail tab) and native (`mailto:`); the fallback sheet's two buttons
are equal width, not one sliver; `ReportButton` still reports correctly after migration; layout at
375px and 1440px.

`npm run lint` and `npx tsc --noEmit` are broken pre-existing and are not gates. Formatting is
Prettier only: 2-space, double quotes, trailing commas, 100-char width.

## Threat Matrix

**N/A** — no shell command, subprocess, VCS or PR automation, executable-file classification, or
process integration. The matrix's "routing" row concerns command and repository routing, not
application screens; adding an expo-router file route introduces no such boundary.

The one external-invocation surface is `openMailComposer`, which is pre-existing and unchanged:
it already wraps every URL segment in `encodeURIComponent` before `Linking.openURL` / `window.open`.
This change feeds it only application-authored strings from a closed three-field context type, so
no user input reaches URL construction. Body content is covered by the credential-leak test above.

## Migration / Rollout

No data migration, no feature flag, no persisted state. One PR on `feat/ui-11-settings`,
forecast ≈850–950 changed lines against an 800-line budget. If the diff must come under budget, the
designated excision is D5's extraction (≈150 lines): drop `useMailComposer`, `MailFallbackSheet`
and the `ReportButton` migration, and inline a local fallback in `Settings.tsx`. That trades a
third copy of the pattern for budget compliance, and is the only piece severable without touching
a requirement.

Rollback: reverting `UserPage.tsx` restores the previous profile exactly; every other file is
additive or an independently revertible extraction.

## Open Questions

- [ ] None blocking.

## Recorded Follow-ups (not fixed here)

- `ReportButton.tsx:125` builds `className` by string concatenation (`"bg-alert " + props.className`),
  so `twMerge` never runs and a caller override cannot win. Same bug class as the one already fixed
  in `ButtonText`. Out of scope here; the migration does not touch that line.
- `AllowedDomainsNotice.tsx` keeps its lighter clipboard-only fallback by design (D5).
- The nine deferred settings groups listed in the proposal, each blocked on backend work.
