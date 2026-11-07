import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Root HTML for the static web export (expo-router "static rendering"). Runs only in Node at
 * export time: no browser APIs and no global CSS imports here.
 *
 * It exists for one reason: `app.json`'s `web.lang` never reaches the exported documents, so every
 * page shipped `<html lang="en">` for a Spanish product. Everything else is expo-router's default
 * document, including `ScrollViewStyleReset` (body scrolling off, so ScrollViews behave as on
 * native).
 */
/**
 * Landing-only typeface: Figtree variable (SIL OFL 1.1, license in `public/fonts`), latin subset,
 * which covers Spanish. Declaring the face costs nothing on other routes: a browser only downloads
 * a face once some element uses it, and only `components/landing` does (`font-landing`).
 * `font-display: swap` keeps text visible; the adjusted local fallback below is scaled to
 * Figtree's measured width (about 90% of Arial's) so the swap does not move the layout.
 */
const LANDING_FONT_CSS = `
@font-face {
  font-family: "Figtree Variable";
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
  src: url(/fonts/figtree-latin-wght-normal.woff2) format("woff2");
}
@font-face {
  font-family: "Figtree Fallback";
  src: local("Arial"), local("Helvetica Neue"), local("Liberation Sans");
  size-adjust: 90.2%;
}`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-AR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style id="landing-font" dangerouslySetInnerHTML={{ __html: LANDING_FONT_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
