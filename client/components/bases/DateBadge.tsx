import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "jue 5 de noviembre"; the year is added only when it is not the current one. */
export const formatDateLabel = (date: Date, now: Date = new Date()): string => {
  const base = `${DAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} de ${date.getFullYear()}`;
};
export const DateBadge = ({
  date,
  className,
  includeTime,
}: {
  date: Date;
  className?: string;
  includeTime?: boolean;
}) => {
  const isToday = date.toDateString() === new Date().toDateString();
  const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();

  let text: string;
  if (isToday) {
    text = "Hoy";
  } else if (isYesterday) {
    text = "Ayer";
  } else {
    text = formatDateLabel(date);
  }
  return (
    <Text className={twMerge("text-secondary-text", className)}>
      {text} {includeTime && date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </Text>
  );
};
