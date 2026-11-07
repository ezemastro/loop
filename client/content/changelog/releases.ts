/**
 * Public changelog data (route `/changelog`, see `components/screens/Changelog.tsx`).
 *
 * The recording process is in `docs/CHANGELOG.md`; `__tests__/changelog.test.ts` enforces the
 * rules that can be checked mechanically (unique IDs, images on disk, alt text, size, banned words).
 * Visitor-facing strings are Spanish; keep this file's code and comments in English.
 */

export type ChangeKind = "novedad" | "mejora" | "arreglo";
export type ChangeViewport = "escritorio" | "celular";

/** One screenshot. `width`/`height` are the CSS-pixel size it was captured at (the capture script prints them). */
export interface ChangelogImage {
  /** Site-absolute path, e.g. `/changelog/1.5.0/chat-celular-antes.webp`; file lives in `client/public/changelog/`. */
  path: string;
  alt: string;
  width: number;
  height: number;
}

export interface Comparison {
  caption?: string;
  viewport: ChangeViewport;
  before?: ChangelogImage;
  after: ChangelogImage;
}

export interface Change {
  /** `C-0001`. Unique forever, never reused, even if the change is later undone. */
  id: string;
  kind: ChangeKind;
  /** Part of the app, e.g. "Chat", "Inicio". */
  area: string;
  title: string;
  /** 1-3 plain sentences: what changed for the person using the app and why it is better. */
  why: string;
  comparisons: Comparison[];
  /** Short git SHAs that implement the change (used to undo it). May be empty until known. */
  commits: string[];
  /** Set only when there is nothing to show on screen (mejora/arreglo otherwise need before and after). */
  noVisual?: boolean;
}

export interface Release {
  /** Equals `client/package.json` version once published. */
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  /** 1-2 plain sentences. */
  summary: string;
  changes: Change[];
}

/** Newest first. */
export const RELEASES: Release[] = [
  {
    version: "1.5.0",
    date: "2026-11-07",
    title: "Una app más ordenada y más clara",
    summary:
      "Esta versión renueva el aspecto de Loop para que sea más consistente y más fácil de usar, y suma esta página para seguir los cambios de cada versión.",
    changes: [
      {
        id: "C-0001",
        kind: "novedad",
        area: "General",
        title: "Página de novedades",
        why: "Ahora hay una página donde se ve qué cambió en cada versión de Loop, con imágenes de cómo era antes y cómo es ahora.",
        comparisons: [],
        commits: [],
      },
    ],
  },
];
