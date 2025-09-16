import { View, Text } from "react-native";

export default function Mission({ mission }: { mission: UserMission }) {
  return (
    <View>
      <Text>{mission.missionTemplate.title}</Text>
    </View>
  );
}
