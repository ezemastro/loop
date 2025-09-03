import { View, Text } from "react-native";

export default function Role({ role }: { role: Role }) {
  return (
    <View className="bg-white p-3 rounded">
      <Text className="text-lg text-center">{role.name}</Text>
    </View>
  );
}
