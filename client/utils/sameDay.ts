export const sameDay = (d1: Date, d2: Date) => {
  d1 = new Date(d1);
  d2 = new Date(d2);
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
};
