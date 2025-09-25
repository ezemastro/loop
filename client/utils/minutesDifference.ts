export const minutesDifference = (date1: Date, date2: Date) => {
  const diff =
    Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) / 1000;
  return Math.floor(diff / 60);
};
