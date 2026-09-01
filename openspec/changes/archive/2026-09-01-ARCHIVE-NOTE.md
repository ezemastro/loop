# Archive note — 2026-09-01

Three SDD changes archived together: they shipped as one 13-commit stack merged to `main`.

| Change | Shipped as |
|---|---|
| `itinere-brand-refresh` | Commit `68f2517` — palette + logo |
| `loop-ui-polish` | Commits `bc5dd83` … `6f1bcca` — 10 slices |
| `loop-settings` | Commit `d9fffd6` — settings screen |

**The authoritative record of what shipped is `REDISENO-UI.md` at the repo root**, not the task
lists in these folders. Read that first.

## Why `loop-ui-polish/tasks.md` shows unchecked boxes that were actually done

The original plan was six slices. After the first two shipped, the user reviewed the running app
and gave a 17-item feedback list, which reorganised the remaining work into eleven slices with a
different order and different file layout. The task list was never rewritten to match, so it
describes a plan that stopped being the plan.

Concretely, unchecked tasks that **were** delivered, just elsewhere:

- **4.1–4.4 (desktop navigation)** — delivered in commit `6f1bcca`. The shared tab array landed at
  `client/components/header/primaryTabs.ts`, not the planned `client/components/navigation/
  primaryTabs.tsx`, and the header nav is a separate `DesktopNavLinks.tsx` component rather than
  inline in `Header.tsx`.
- **3.1–3.6 (two-column detail, gallery)** — delivered in commit `9c464b9`.

Unchecked tasks that were **genuinely not done**:

- **3.7, 3.10** — visual readback at exactly 1024×768, and manually crossing the 1023↔1024px
  boundary to confirm no remount. Verification was done by rendering at 390 / 800 / 1100 / 1440 /
  1920 px and by measuring the DOM, but not at those two specific conditions.
- **Slice 5 of the original plan — the mobile polish pass.** This one was dropped when the plan was
  reorganised and never re-added. See the "Still pending" section of `REDISENO-UI.md`.

## Lesson recorded

A task list is only useful while it still describes the plan. Once user feedback reorganised the
work, the list should have been regenerated rather than left to drift — its unchecked boxes now
carry no signal, since some mean "not done" and others mean "done differently".
