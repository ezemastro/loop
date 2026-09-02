/** Las fechas de la API viajan como string ISO, así que se parsean acá y no en cada llamador. */
export const minutesDifference = (date1: string, date2: string) => {
  const diff = Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) / 1000;
  return Math.floor(diff / 60);
};
