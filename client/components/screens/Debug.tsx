import { Pressable, Text, View } from "react-native";
import { MainView } from "../bases/MainView";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import BackButton from "../BackButton";
import { HomeIcon } from "../Icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DebugPage() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [debugFetchResult, setDebugFetchResult] = useState("");
  useEffect(() => {
    fetch(process.env.EXPO_PUBLIC_API_URL + "/status")
      .then((res) => res.text())
      .then((text) => {
        setDebugFetchResult(text);
      })
      .catch((err) => {
        setDebugFetchResult(`Error: ${err.message}`);
      });
  }, []);
  return (
    <View
      className="flex-1"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <MainView className="p-4 gap-4">
        <View className="flex-row justify-between items-center">
          <BackButton />
          <Pressable onPress={() => router.replace("/")}>
            <HomeIcon className="text-main-text" />
          </Pressable>
        </View>
        <Text>Debug</Text>
        <Text>API URL: {process.env.EXPO_PUBLIC_API_URL}</Text>
        <Text>User: {user ? JSON.stringify(user) : "No user logged in"}</Text>
        <Text>Debug Fetch Result: {debugFetchResult}</Text>
      </MainView>
    </View>
  );
}
