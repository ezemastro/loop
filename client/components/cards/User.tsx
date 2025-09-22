import { View, Text, Image } from "react-native";

export default function User({ user }: { user: PublicUser }) {
  return (
    <View className="p-2 flex-row bg-white rounded">
      <Image
        source={{ uri: user.profileMedia?.url }}
        className="size-16 rounded-full bg-background"
      />
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl text-main-text">
          {user.firstName} {user.lastName}
        </Text>
        <View className="flex-row gap-1">
          <Text className="text-secondary-text ">{user.school.name}</Text>
          <Text className="text-secondary-text">-</Text>
          <Text className="text-secondary-text font-light">
            {user.role.name}
          </Text>
        </View>
      </View>
    </View>
  );
}
