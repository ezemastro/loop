/**
 * Shared layout and shape rules for the marketing landing (`MarketingLanding.tsx`).
 *
 * Every section aligns its content to the same container, so the page reads as one column grid
 * at any width instead of each section picking its own max width and gutter.
 *
 * Shape system, applied everywhere on the landing:
 * - interactive controls (buttons, nav CTA): fully rounded (`rounded-full`);
 * - panels and cards: `rounded-3xl`;
 * - device frames (laptop, phone) keep their own physical radii, they imitate hardware.
 *
 * Accent logic: orange (`primary`) only for the primary action, teal (`tertiary`) for the
 * secondary action, navy (`secondary`) for headings, active states and dark blocks, and the
 * credits color only next to loopies.
 */

/** One max width and one gutter for every landing section. */
export const LANDING_CONTAINER = "mx-auto w-full max-w-[1200px] px-5 lg:px-10";

/** Vertical rhythm shared by the regular (non-band) sections. */
export const SECTION_PADDING = "py-16 lg:py-24";

/** Body copy color: darker than `secondary-text`, which fails AA contrast on white. */
export const BODY_TEXT = "text-main-text/80";

/** Section heading scale (h2). The hero headline has its own, larger scale. */
export const SECTION_HEADING =
  "text-2xl font-bold text-main-text lg:text-[2rem] lg:leading-[2.5rem]";

/** Keyboard focus ring for every custom pressable on the landing (web `:focus-visible`). */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary";
