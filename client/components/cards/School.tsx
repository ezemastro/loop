import { View, Text, Image } from "react-native";

export default function School({ school }: { school: School }) {
  return (
    <View className="p-1 flex-row bg-white rounded">
      <View>
        <Image source={{ uri: school.media.url }} className="size-16" />
      </View>
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl">{school.name}</Text>
      </View>
    </View>
  );
}
