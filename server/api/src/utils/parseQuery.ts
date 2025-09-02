export const parseQuery = (query: unknown) => {
  // Return query parsing keys to undefined if "undefined"
  if (typeof query !== "object" || query === null) return {};
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) =>
      value === "undefined" ? [key, undefined] : [key, value],
    ),
  );
};
