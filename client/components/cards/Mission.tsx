import { View, Text } from "react-native";
import CreditsBadge from "../badges/CreditsBadge";
import { twMerge } from "tailwind-merge";
import { missionProgressPercent } from "@/utils/missionProgressPercent";
import { CheckIcon } from "../Icons";

export default function Mission({
  mission,
  className,
}: {
  mission: UserMission;
  className?: string;
}) {
  return (
    <View
      className={twMerge(
        "flex-row items-center gap-3 rounded-xl border border-stroke bg-white p-3",
        className,
      )}
    >
      {/* RN-web Views default to flex-shrink: 0, so without `min-w-0 flex-1` a long title keeps its
          intrinsic width and pushes the reward badge off the card. */}
      <View className="min-w-0 flex-1 gap-2">
        <View className="gap-0.5">
          <View className="flex-row items-center gap-2">
            {mission.completed ? <CheckIcon size={18} className="text-accent" /> : null}
            <Text className="flex-1 text-left text-base font-medium text-main-text">
              {mission.missionTemplate.title}
            </Text>
          </View>
          {mission.missionTemplate.description && (
            <Text className="text-left text-sm text-secondary-text">
              {mission.missionTemplate.description}
            </Text>
          )}
        </View>
        <View className="gap-1">
          <View className="h-2 overflow-hidden rounded-full bg-background">
            <View
              className="h-full rounded-full bg-accent"
              style={{
                width: `${missionProgressPercent(mission.progress.current, mission.progress.total)}%`,
              }}
            />
          </View>
          <Text className="text-xs text-secondary-text">
            {mission.completed
              ? "Completada"
              : `${mission.progress.current} / ${mission.progress.total}`}
          </Text>
        </View>
      </View>
      <CreditsBadge credits={mission.missionTemplate.rewardCredits} vertical />
    </View>
  );
}
