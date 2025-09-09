import { useSessionStore } from "@/stores/session";
import { useEffect } from "react";
import { View, Text } from "react-native";

export default function ProfilePage() {
  const { logout } = useSessionStore();
  useEffect(() => {
    logout();
  }, [logout]);
  return (
    <View>
      <Text>Profile</Text>
    </View>
  );
}
