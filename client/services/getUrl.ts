import { FILE_BASE_URL } from "@/config";
import { ImageSourcePropType } from "react-native";
import { DEMO_LISTING_IMAGES } from "@/demo/assets/listingImages";

const DEFAULT_PROFILE_IMAGE = require("@/assets/images/default-profile.png");

export const getUrl = (path: string) => {
  // Las URLs absolutas (ej. las imágenes del modo demo) se usan tal cual; el prefijo solo aplica
  // a rutas relativas servidas por la API.
  if (/^https?:\/\//i.test(path)) return path;
  return `${FILE_BASE_URL}${path}`;
};

export const getProfileImageSource = (path?: string | null): ImageSourcePropType => {
  if (!path?.trim()) return DEFAULT_PROFILE_IMAGE;
  return { uri: getUrl(path) };
};

/** Matches the picsum placeholder shape the demo dataset builds (`shared/demo-data/buildCommunity.ts`). */
const DEMO_PICSUM_SEED_RE = /^https:\/\/picsum\.photos\/seed\/([^/]+)\//;

/**
 * Listing images go through this instead of plain `getUrl` so the demo dataset's seeded listings
 * (`shared/demo-data`) can show a real bundled photo of the actual product instead of a random
 * picsum placeholder — see `client/demo/assets/listingImages.ts`. A bundled `require()` result is
 * itself a valid `ImageSourcePropType`, so it's returned as-is rather than wrapped in `{ uri }`;
 * this also sidesteps `getUrl`'s API-relative-path prefixing, which a bundled asset's resolved URI
 * wouldn't match. Anything not in the map (real uploads, the two dev-only communities' listings)
 * falls back to `getUrl` unchanged.
 */
export const getListingImageSource = (url: string): ImageSourcePropType => {
  const seed = DEMO_PICSUM_SEED_RE.exec(url)?.[1];
  const bundled = seed ? DEMO_LISTING_IMAGES[seed] : undefined;
  return bundled ?? { uri: getUrl(url) };
};
