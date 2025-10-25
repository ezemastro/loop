import { View, Text } from "react-native";
import CreditsBadge from "../badges/CreditsBadge";

export default function Mission({ mission }: { mission: UserMission }) {
  return (
    <View className="flex-row bg-white p-2 rounded gap-2 items-center">
      <View className="flex-grow justify-between gap-2">
        <View className="items-center">
          <Text className="text-main-text text-lg text-center">
            {mission.missionTemplate.title}
          </Text>
          {mission.missionTemplate.description && (
            <Text className="text-secondary-text text-sm text-center max-w-80">
              {mission.missionTemplate.description}
            </Text>
          )}
        </View>
        <View>
          <View className="flex-grow bg-secondary-text/40 rounded-full h-5 relative items-center justify-center">
            <View
              className="bg-credits h-full rounded-full absolute left-0 top-0"
              style={{
                width: `${(mission.progress.current / mission.progress.total) * 100}%`,
              }}
            />
            <Text className="font-semibold w-full text-center text-sm text-white">
              {mission.progress.current} / {mission.progress.total}
            </Text>
          </View>
        </View>
      </View>
      <View className="bg-stroke/40 self-stretch w-0.5 rounded-full" />
      <View>
        <CreditsBadge
          credits={mission.missionTemplate.rewardCredits}
          vertical
        />
      </View>
    </View>
  );
}
