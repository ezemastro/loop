export const SORT = {
  createdAt: "created_at",
  price: "price_credits",
  title: "title",
  updatedAt: "updated_at",
  listingStatus: "listing_status",
  category: "category_id",
  seller: "seller_id",
  buyer: "buyer_id",
} as const;
export const DEFAULT_SORT_OPTION = SORT.createdAt;
export const SORT_OPTIONS = Object.keys(SORT);
export const getSortValue = (key?: keyof typeof SORT) => {
  if (!key) return DEFAULT_SORT_OPTION;
  return SORT[key] || DEFAULT_SORT_OPTION;
};
export const getOrderValue = (order?: string) => {
  if (!order) return "desc";
  return order.toLowerCase() === "asc" ? "asc" : "desc";
};
