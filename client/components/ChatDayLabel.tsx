import { View, Text } from "react-native";
const getShortDayName = (date: Date) => {
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  return days[date.getDay()];
};

export default function ChatDayLabel({ date }: { date: Date }) {
  date = new Date(date);
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
    <View className="items-center p-2">
      <Text className="text-secondary-text">{text}</Text>
    </View>
  );
}
