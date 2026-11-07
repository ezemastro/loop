import { View } from "react-native";
import { DateBadge } from "./bases/DateBadge";

export default function ChatDayLabel({ date }: { date: string }) {
  // `DateBadge` sí quiere un `Date` de verdad: acá es donde se parsea el string del cable.
  const parsedDate = new Date(date);
  return (
    <View className="items-center pb-1 pt-4">
      <DateBadge date={parsedDate} className="text-xs" />
    </View>
  );
}
