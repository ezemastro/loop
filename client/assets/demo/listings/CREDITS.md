# Demo listing photo credits

Real photos for the demo dataset's listings (`shared/demo-data`), replacing the generic
`picsum.photos` placeholders. All sourced from Unsplash under the
[Unsplash License](https://unsplash.com/license) (free to use, no attribution legally required —
credited here anyway as good practice). Downloaded, resized to 800px wide and re-encoded to webp;
each original is linked below for provenance.

Wired up via `client/demo/assets/listingImages.ts` (seed → bundled asset) and
`client/services/getUrl.ts`'s `getListingImageSource`. See that file's header comment for how the
seed keys map back to `shared/demo-data/blueprints.ts`.

| File | Photographer | Source |
|---|---|---|
| `loop-demo-buzo-1.webp` | Moses Janga | https://unsplash.com/photos/gray-crew-neck-shirt-on-white-clothes-hanger-WV80-Rf-a3A |
| `loop-demo-buzo-2.webp` | Cristofer Maximilian | https://unsplash.com/photos/hanged-grey-shirt-on-white-wall-AqLIkOzWDAk |
| `loop-demo-cartuchera.webp` | Markus Spiske | https://unsplash.com/photos/white-and-red-floral-pouch-AmOm6BDUcMM |
| `loop-demo-geometria.webp` | Ranurte | https://unsplash.com/photos/a-wooden-ruler-and-a-wooden-triangle-on-a-blue-background-mYwvdQpLuE0 |
| `loop-demo-cuadernos.webp` | Hope House Press — Leather Diary Studio | https://unsplash.com/photos/filed-four-books-IOzk8YKDhYg |
| `loop-demo-mochila-1.webp` | Samantha Hawley | https://unsplash.com/photos/yellow-water-bottle-in-blue-backpack-MrZ7gW5z8sc |
| `loop-demo-mochila-2.webp` | Sindre Aalberg | https://unsplash.com/photos/a-blue-backpack-sitting-on-top-of-a-white-pedestal-q1Wd5MJvcKo |
| `loop-demo-botella.webp` | Karl Köhler | https://unsplash.com/photos/black-mizu-stainless-steel-tumbler-dGIEMeN2MV8 |
| `loop-demo-acuarelas.webp` | Sixteen Miles Out | https://unsplash.com/photos/a-box-of-watercolors-and-a-set-of-brushes-aoKWD-62Wyg |
| `loop-demo-zapatos.webp` | Erik Mclean | https://unsplash.com/photos/two-black-dress-shoes-sit-on-a-floral-patterned-rug-CMTmGGNMQek |
| `loop-demo-marcadores.webp` | Hal Gatewood | https://unsplash.com/photos/assorted-color-sign-pens-qv9scCkdyyg |
| `loop-demo-carpeta.webp` | Kelly Sikkema | https://unsplash.com/photos/a-close-up-of-a-book-xQsoV7Zf5iw |
| `loop-demo-lapices.webp` | Bec R. | https://unsplash.com/photos/a-group-of-colored-pencils-lined-up-on-a-white-surface-m6-mpL5qU6A |

## Out of scope

- Avatars, school photos and the community logo (`shared/demo-data/buildCommunity.ts`'s other
  `media(...)` calls) still use `picsum.photos` placeholders — only listing photos were in scope.
- `client/demo/handlers/uploads.ts` still returns a `picsum.photos` URL for a photo uploaded
  *during* a demo session (e.g. while publishing a new listing in demo mode). That's a synthetic
  runtime upload, not one of the 13 seeded listing photos above, so it was left as-is.
- The two dev-only communities (`colegio-verde`, `instituto-austral`, `shared/demo-data/blueprints.ts`)
  aren't part of the production demo (`DEMO_BLUEPRINTS`) and keep their picsum placeholders too.
- `server/api/src/scripts/seed.ts`'s Postgres dev-seed path still writes the original picsum URL for
  every `DemoMedia` (listings included) — the bundled photos here are a client-only asset, resolved
  through `getListingImageSource`, and don't exist as network-reachable files the seeded dev
  Postgres/API stack could serve.
