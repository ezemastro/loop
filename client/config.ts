export const COLORS = {
  PRIMARY: "#FF5900",
  SECONDARY: "#4C9F38",
  TERTIARY: "#009E7C",
  MAIN_TEXT: "#424242",
  SECONDARY_TEXT: "#9E9E9E",
  CREDITS: "#8436D1",
  CREDITS_LIGHT: "#8F4CD1",
  STROKE: "#E4E4E4",
  BACKGROUND: "#F0F0F0",
  ALERT: "#FF3B30",
};
export const MAX_LISTING_IMAGES = 7;
export const MAX_LISTING_TITLE_LENGTH = 50;
export const MAX_LISTING_DESCRIPTION_LENGTH = 150;

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
export const FILE_BASE_URL = API_URL + "/uploads/";

export const VALID_EMAIL_DOMAINS = ["northfield.edu.ar", "gmail.com"];

export const PRODUCT_STATUSES = {
  FAIR: "fair" as ProductStatus,
  GOOD: "good" as ProductStatus,
  VERY_GOOD: "very_good" as ProductStatus,
  LIKE_NEW: "like_new" as ProductStatus,
  NEW: "new" as ProductStatus,
};

export const STATUS_TRANSLATIONS = {
  [PRODUCT_STATUSES.NEW]: "Nuevo",
  [PRODUCT_STATUSES.LIKE_NEW]: "Como nuevo",
  [PRODUCT_STATUSES.VERY_GOOD]: "Muy bueno",
  [PRODUCT_STATUSES.GOOD]: "Bueno",
  [PRODUCT_STATUSES.FAIR]: "Regular",
} as Record<ProductStatus, string>;
