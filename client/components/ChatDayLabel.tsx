import { View } from "react-native";
import { DateBadge } from "./bases/DateBadge";

export default function ChatDayLabel({ date }: { date: Date }) {
  date = new Date(date);
  return (
    <View className="items-center p-2">
      <DateBadge date={date} />
    </View>
  );
}
