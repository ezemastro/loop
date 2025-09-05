import { useSessionStore } from "@/stores/session";
import { View, Text } from "react-native";

export default function ProfilePage() {
  const { logout } = useSessionStore();
  logout();
  return (
    <View>
      <Text>Profile</Text>
    </View>
  );
}
