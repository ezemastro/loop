import { getProfileImageSource } from "@/services/getUrl";
import { View, Text, Image } from "react-native";
import { twMerge } from "tailwind-merge";
import SchoolLogo from "../SchoolLogo";

/**
 * `row` is the plain list-row look used inside selector modals (no card chrome, divider below);
 * the default is a compact card.
 */
export default function User({
  user,
  className,
  row = false,
}: {
  user: PublicUser;
  className?: string;
  row?: boolean;
}) {
  return (
    // `max-w-xs self-start` keeps the card compact wherever it's dropped -- without it, a stretchy
    // parent (a full-width notification card, a full-width list row) hands this the whole row,
    // flinging the avatar to the far left and centering the name in the empty band that's left.
    <View
      className={twMerge(
        row
          ? "w-full flex-row items-center gap-3 border-b border-stroke px-1 py-3"
          : "max-w-xs w-full flex-row items-center gap-3 self-start rounded-xl bg-white p-2",
        className,
      )}
    >
      <Image
        source={getProfileImageSource(user.profileMedia?.url)}
        className="rounded-full bg-background"
        style={{ width: row ? 44 : 56, height: row ? 44 : 56 }}
      />
      <View className="flex-1 justify-center gap-1">
        <Text className="text-base font-medium text-main-text" numberOfLines={1}>
          {user.firstName} {user.lastName}
        </Text>
        {user.schools.length > 0 && (
          <View className="flex-row gap-1">
            {user.schools.map((s) => (
              <SchoolLogo key={s.id} school={s} size={24} className="rounded-full bg-background" />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
