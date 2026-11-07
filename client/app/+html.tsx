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
 * Web typeface: Figtree variable (SIL OFL 1.1, license in `public/fonts`), latin subset, which
 * covers Spanish. The landing asks for it by name (`font-landing`); the rest of the web app gets
 * it through the `-apple-system` face below. `font-display: swap` keeps text visible.
 *
 * The adjusted local fallback ("Figtree Fallback", scaled to Figtree's measured width, about 90%
 * of Arial's) is only part of the landing's own font stack, so only the landing swaps without
 * moving its layout. The app stack has no such stage: it falls back to the browser's system font
 * until Figtree arrives, and the text may reflow slightly once at first load.
 */
const FONT_FILE = 'url(/fonts/figtree-latin-wght-normal.woff2) format("woff2")';
const LANDING_FONT_CSS = `
@font-face {
  font-family: "Figtree Variable";
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
  src: ${FONT_FILE};
}
/*
 * react-native-web's default stack starts with the -apple-system system-font keyword, and
 * every Text inherits it. Declaring an author face with that exact name makes browsers use this
 * file instead of the keyword, so the whole app switches to Figtree without touching a single
 * Text. Icon fonts (Feather, Ionicons) set their own family and are unaffected. Native keeps the
 * system font: this file only exists in the web export.
 */
@font-face {
  font-family: "-apple-system";
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
  src: ${FONT_FILE};
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
