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
export const getSortValue = (key?: SortOptions) => {
  if (!key) return DEFAULT_SORT_OPTION;
  return SORT[key] || DEFAULT_SORT_OPTION;
};
export const getOrderValue = (order?: string) => {
  if (!order) return "desc";
  return order.toLowerCase() === "asc" ? "asc" : "desc";
};
