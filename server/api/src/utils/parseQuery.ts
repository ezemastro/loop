export const parseQuery = (query: unknown) => {
  // Devuelve undefined si el valor es la cadena "undefined"
  // o si el valor es ""
  if (typeof query !== "object" || query === null) return {};
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) =>
      value === "undefined" || value === "" ? [key, undefined] : [key, value],
    ),
  );
};
