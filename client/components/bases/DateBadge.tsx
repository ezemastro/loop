import { Text } from "react-native";
import { twMerge } from "tailwind-merge";

const getShortDayName = (date: Date) => {
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  return days[date.getDay()];
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
  const isYesterday =
    date.toDateString() === new Date(Date.now() - 86400000).toDateString();

  let text: string;
  if (isToday) {
    text = "Hoy";
  } else if (isYesterday) {
    text = "Ayer";
  } else {
    text = getShortDayName(date) + ". " + date.toLocaleDateString();
  }
  return (
    <Text className={twMerge("text-secondary-text", className)}>
      {text}{" "}
      {includeTime &&
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </Text>
  );
};
