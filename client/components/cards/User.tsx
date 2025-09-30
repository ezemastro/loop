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
        <Text className="text-secondary-text ">
          {user.schools.map((s) => s.name).join(", ")}
        </Text>
      </View>
    </View>
  );
}
