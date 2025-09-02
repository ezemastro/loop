export const safeNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return isNaN(parsed) ? undefined : parsed;
};
