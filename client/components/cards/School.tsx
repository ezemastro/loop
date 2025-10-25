import { getUrl } from "@/services/getUrl";
import { View, Text, Image } from "react-native";
import { twMerge } from "tailwind-merge";

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
        <Image
          source={{ uri: getUrl(school.media.url) }}
          className="size-16"
          style={{ resizeMode: "contain" }}
        />
      </View>
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl">{school.name}</Text>
      </View>
    </View>
  );
}
