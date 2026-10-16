/**
 * Real bundled photos for the demo dataset's listings.
 *
 * `shared/demo-data/buildCommunity.ts` builds every `DemoMedia.url` as
 * `https://picsum.photos/seed/<seed>/800/600` — a placeholder unrelated to the listing's title.
 * This map swaps the *listing* photos (not avatars, schools or the community logo, which stay on
 * picsum — out of scope here) for real, locally-bundled photos of the actual product, keyed by
 * that same `<seed>` string from `shared/demo-data/blueprints.ts`'s `images: [...]` arrays.
 *
 * Metro needs `require()` calls to be static (no dynamic path), so this is a literal object, not a
 * loop. `client/services/getUrl.ts`'s `getListingImageSource` is the only consumer — it looks a
 * seed up here first and only falls back to the picsum URL (via `getUrl`) when it's missing, which
 * keeps the two dev-only communities (`colegio-verde`, `instituto-austral` — never shipped to the
 * production demo, see `shared/demo-data/blueprints.ts`) working unchanged.
 *
 * Source, photographer and license per file: `client/assets/demo/listings/CREDITS.md`.
 */
export const DEMO_LISTING_IMAGES: Record<string, ReturnType<typeof require>> = {
  "loop-demo-buzo-1": require("../../assets/demo/listings/loop-demo-buzo-1.webp"),
  "loop-demo-buzo-2": require("../../assets/demo/listings/loop-demo-buzo-2.webp"),
  "loop-demo-cartuchera": require("../../assets/demo/listings/loop-demo-cartuchera.webp"),
  "loop-demo-geometria": require("../../assets/demo/listings/loop-demo-geometria.webp"),
  "loop-demo-cuadernos": require("../../assets/demo/listings/loop-demo-cuadernos.webp"),
  "loop-demo-mochila-1": require("../../assets/demo/listings/loop-demo-mochila-1.webp"),
  "loop-demo-mochila-2": require("../../assets/demo/listings/loop-demo-mochila-2.webp"),
  "loop-demo-botella": require("../../assets/demo/listings/loop-demo-botella.webp"),
  "loop-demo-acuarelas": require("../../assets/demo/listings/loop-demo-acuarelas.webp"),
  "loop-demo-zapatos": require("../../assets/demo/listings/loop-demo-zapatos.webp"),
  "loop-demo-marcadores": require("../../assets/demo/listings/loop-demo-marcadores.webp"),
  "loop-demo-carpeta": require("../../assets/demo/listings/loop-demo-carpeta.webp"),
  "loop-demo-lapices": require("../../assets/demo/listings/loop-demo-lapices.webp"),
};
