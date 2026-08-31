/**
 * Paleta de respaldo. Se usa mientras no hay comunidad resuelta y como fallback por clave cuando
 * una comunidad trae el tema incompleto. Los mismos valores están duplicados en `global.css`
 * (como canales RGB) porque el CSS es estático y no puede importar de acá: si se toca uno, tocar
 * el otro.
 */
export const DEFAULT_COLORS = {
  PRIMARY: "#E4510B",
  SECONDARY: "#243B7A",
  TERTIARY: "#209B8A",
  MAIN_TEXT: "#3D3D3D",
  SECONDARY_TEXT: "#9E9E9E",
  CREDITS: "#7D2048",
  CREDITS_LIGHT: "#A03A63",
  STROKE: "#E4E4E4",
  BACKGROUND: "#F0F0F0",
  ALERT: "#C52525",
};

export type ThemeColorKey = keyof typeof DEFAULT_COLORS;
export type ThemeColors = Record<ThemeColorKey, string>;

/**
 * Alias histórico. Los componentes deben usar `useThemeColors()`, que respeta la comunidad activa;
 * `COLORS` siempre devuelve la paleta por defecto.
 */
export const COLORS = DEFAULT_COLORS;
export const MAX_LISTING_IMAGES = 7;
export const MAX_LISTING_TITLE_LENGTH = 50;
export const MAX_LISTING_DESCRIPTION_LENGTH = 150;
export const MAX_IMAGE_SIDE_PX = 1600;
export const IMAGE_COMPRESS_QUALITY = 0.8;
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export const WEB_IMAGE_ACCEPT_ATTR = ALLOWED_IMAGE_MIME_TYPES.join(",");
export const IMAGE_FORMAT_ERROR_MESSAGE = "Solo se permiten imágenes JPG, PNG, WEBP o AVIF.";

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const FILE_BASE_URL = API_URL + "/uploads/";
console.log("API_URL:", API_URL);
console.log(".env working: ", process.env.EXPO_PUBLIC_ENV_WORKING);

/** Modo demo: intercepta las llamadas a la API con datos simulados (no toca la red). */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

export const ANDROID_GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID;
export const IOS_GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID;
export const WEB_GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID;
export const REPORT_EMAIL = process.env.EXPO_PUBLIC_REPORT_EMAIL;

/** Mail de contacto general: aparece donde el usuario necesita escribirnos (ej. sin mail institucional). */
export const CONTACT_EMAIL = "loop@reditinere.com";
export const GOOGLE_OAUTH_READY = process.env.GOOGLE_OAUTH_READY !== "false";
export const NODE_ENV = process.env.NODE_ENV;

export const PRODUCT_STATUSES = {
  LIKE_NEW: "like_new" as ProductStatus,
  GOOD: "good" as ProductStatus,
  FAIR: "fair" as ProductStatus,
};

export const STATUS_TRANSLATIONS = {
  [PRODUCT_STATUSES.LIKE_NEW]: "Como nuevo",
  [PRODUCT_STATUSES.GOOD]: "Bueno",
  [PRODUCT_STATUSES.FAIR]: "Regular",
} as Record<ProductStatus, string>;

export const PRICE_STATUS_MULTIPLIERS: Record<ProductStatus, number> = {
  [PRODUCT_STATUSES.LIKE_NEW]: 1,
  [PRODUCT_STATUSES.GOOD]: 0.7,
  [PRODUCT_STATUSES.FAIR]: 0.4,
};

export const NOTIFICATIONS_CATEGORIES = {
  MISSION: "mission",
  LOOP: "loop",
  DONATION: "donation",
  ADMIN: "admin",
  MESSAGE: "message",
};

/**
 * Single source of breakpoint truth. Must match Tailwind's default `theme.screens`
 * (`tailwind.config.js` is not overridden) — asserted in `__tests__/responsive-tokens.test.ts`.
 * Used by `useBreakpoint()` for JS-side props that cannot be expressed as classes.
 */
export const BREAKPOINTS = {
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * Shadow scale. `boxShadow` on native only maps `shadowColor` + `shadowRadius` (`spread`, always
 * `0` in Tailwind's defaults, is the only source `shadowOffset`/`shadowOpacity`/`elevation` could
 * come from) — so `class` (web) and `native` (Platform.select style object) must be projected
 * separately. `class` reproduces today's web appearance; `native` is a native-only visual gain.
 */
export const ELEVATION = {
  raised: {
    class: "shadow",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
  },
  overlay: {
    class: "shadow-md",
    native: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
  },
} as const;

/** Carousel/Image height per breakpoint — not expressible as a class (native `height` prop). */
export const GALLERY_HEIGHT = {
  base: 260,
  md: 360,
  lg: 420,
  xl: 420,
} as const;

/** Number of `ListingSkeleton` placeholders rendered inside `ListingGrid` on initial load. */
export const SKELETON_COUNT = 4;
