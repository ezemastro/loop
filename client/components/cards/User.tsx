import { getUrl } from "@/services/getUrl";
import { View, Text, Image } from "react-native";
import { twMerge } from "tailwind-merge";

export default function User({
  user,
  className,
}: {
  user: PublicUser;
  className?: string;
}) {
  return (
    <View className={twMerge("p-2 flex-row bg-white rounded", className)}>
      <Image
        source={{ uri: getUrl(user.profileMedia?.url ?? "") }}
        className="rounded-full bg-background"
        style={{ width: 64, height: 64 }}
      />
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl text-main-text">
          {user.firstName} {user.lastName}
        </Text>
        <View className="flex-row">
          {user.schools.map((s) => (
            <Image
              key={s.id}
              source={{ uri: getUrl(s.media.url) }}
              className="rounded-full bg-background mx-1"
              style={{ width: 32, height: 32 }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
