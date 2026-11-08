import { View, Text } from "react-native";
import { twMerge } from "tailwind-merge";
import SchoolLogo from "../SchoolLogo";
import { CheckIcon } from "../Icons";

/** A school as a plain list row (selector modals). The selected one gets a check, not a border. */
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
        "w-full flex-row items-center gap-3 border-b border-stroke px-1 py-3",
        isSelected ? "bg-accent/5" : "",
        className,
      )}
    >
      <SchoolLogo school={school} size={44} resizeMode="contain" />
      <Text className="flex-1 text-left text-base font-medium text-main-text">{school.name}</Text>
      {isSelected ? <CheckIcon size={20} className="text-accent" /> : null}
    </View>
  );
}
