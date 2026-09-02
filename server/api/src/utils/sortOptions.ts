export const SORT: Record<SortOptions, string> = {
  createdAt: "created_at",
  price: "price_credits",
  title: "title",
  updatedAt: "updated_at",
  listingStatus: "listing_status",
  categoryId: "category_id",
  sellerId: "seller_id",
  buyerId: "buyer_id",
} as const;
export const DEFAULT_SORT_OPTION = SORT.createdAt;
export const DEFAULT_ORDER_OPTION = "desc";
export const SORT_OPTIONS = Object.keys(SORT);

/**
 * Columna real, tal como sale del mapa `SORT`. Es un tipo **branded** por construcción: solo
 * `getSortValue` produce un valor de este tipo, así que las factories de queries (`queries.ts`)
 * pueden tipar su parámetro como `SortColumn` en vez de `string` y el compilador rechaza que un
 * cuarto call site pase una columna arbitraria (SEC-13, D10). No hay injection reachable hoy — dos
 * allowlists ya lo cubren (los enums de Zod y este mapa) — esto solo mueve la garantía del
 * convenio al tipo.
 */
export type SortColumn = (typeof SORT)[SortOptions];
export type SortDirection = "asc" | "desc";

export const getSortValue = (key?: SortOptions): SortColumn => {
  if (!key) return DEFAULT_SORT_OPTION;
  return SORT[key] || DEFAULT_SORT_OPTION;
};
export const getOrderValue = (order?: string): SortDirection => {
  if (!order) return "desc";
  return order.toLowerCase() === "asc" ? "asc" : "desc";
};
