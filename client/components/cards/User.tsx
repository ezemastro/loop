import { getProfileImageSource, getUrl } from "@/services/getUrl";
import { View, Text, Image } from "react-native";
import { twMerge } from "tailwind-merge";

export default function User({ user, className }: { user: PublicUser; className?: string }) {
  return (
    // `max-w-xs self-start` keeps this compact wherever it's dropped -- without it, a stretchy
    // parent (a full-width notification card, a full-width list row) hands this the whole row,
    // flinging the avatar to the far left and centering the name in the empty band that's left.
    <View
      className={twMerge(
        "max-w-xs w-full flex-row items-center gap-3 self-start rounded bg-white p-2",
        className,
      )}
    >
      <Image
        source={getProfileImageSource(user.profileMedia?.url)}
        className="rounded-full bg-background"
        style={{ width: 64, height: 64 }}
      />
      <View className="flex-1 justify-center gap-1">
        <Text className="text-xl text-main-text" numberOfLines={1}>
          {user.firstName} {user.lastName}
        </Text>
        {user.schools.length > 0 && (
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
        )}
      </View>
    </View>
  );
}
