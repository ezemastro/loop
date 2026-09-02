import { View, Text } from "react-native";
import { twMerge } from "tailwind-merge";
import SchoolLogo from "../SchoolLogo";

export default function School({
  school,
  isSelected,
  className,
}: {
  school: School;
  isSelected?: boolean;
  className?: string;
}) {
  return (
    <View
      className={twMerge(
        "p-1 flex-row bg-white rounded border " +
          (isSelected ? "border-tertiary" : "border-transparent"),
        className,
      )}
    >
      <View>
        <SchoolLogo school={school} size={64} resizeMode="contain" />
      </View>
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl">{school.name}</Text>
      </View>
    </View>
  );
}
