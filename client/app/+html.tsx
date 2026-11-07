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
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es-AR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
