import { FlatList, Image, Pressable, Text, View } from "react-native";
import { MainView } from "../bases/MainView";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import BackButton from "../BackButton";
import { HomeIcon } from "../Icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, FILE_BASE_URL } from "@/config";
import { api } from "@/api/loop";
import { useSessionHydrated, useSessionStore } from "@/stores/session";

export default function DebugPage() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // El estado del modo demo se lee del store y no del módulo: el store es el que lo persiste, y
  // dos fuentes de verdad para lo mismo terminan siempre desincronizadas.
  const demoMode = useSessionStore((state) => state.demoMode);
  const hydrated = useSessionHydrated();
  const enterDemoMode = useSessionStore((state) => state.enterDemoMode);
  const logout = useSessionStore((state) => state.logout);
  const [debugFetchResult, setDebugFetchResult] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  // Salir de la demo es cerrar sesión: la sesión simulada no sobrevive a apagar el modo.
  const toggleDemoMode = () => (demoMode ? logout() : enterDemoMode());

  useEffect(() => {
    // Dos condiciones, y ninguna sobra.
    //
    // `hydrated` primero: `/debug` es una ruta pública, se llega por deeplink o por URL directa, y
    // en ese arranque en frío este efecto corre **antes** de que el store vuelva de AsyncStorage.
    // Sin esperar, `demoMode` valdría `false` aunque el dispositivo esté en modo demo, y la
    // request saldría igual.
    //
    // Y va por `api`, no por `fetch` crudo, para que la pase el adaptador del modo demo: si esta
    // guarda se rompiera algún día, la request sigue sin llegar a la red.
    if (!hydrated) return;
    if (demoMode) {
      setDebugFetchResult("(modo demo: no se consulta la API)");
      return;
    }
    api
      .get<string>("/status", { responseType: "text" })
      .then((res) => setDebugFetchResult(String(res.data)))
      .catch((err) => setDebugFetchResult(`Error: ${err.message}`));
  }, [demoMode, hydrated]);
  return (
    <View className="flex-1" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <MainView className="p-4 gap-4">
        <View className="flex-row justify-between items-center">
          <BackButton />
          <Pressable onPress={() => router.replace("/")}>
            <HomeIcon className="text-main-text" />
          </Pressable>
        </View>
        <Text>Debug</Text>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1">
            Modo demo: {demoMode ? "ACTIVADO (no hay llamadas a la API)" : "desactivado"}
          </Text>
          <Pressable
            onPress={toggleDemoMode}
            className={
              "rounded-lg px-3 py-1.5 active:opacity-70 " + (demoMode ? "bg-alert" : "bg-primary")
            }
          >
            <Text className="font-semibold text-white">{demoMode ? "Apagar" : "Encender"}</Text>
          </Pressable>
        </View>
        <Text>ENV API URL: {process.env.EXPO_PUBLIC_API_URL}</Text>
        <Text>CONFIG API URL: {API_URL}</Text>
        <Text>Images URL: {FILE_BASE_URL}</Text>
        <Image
          source={{
            uri: FILE_BASE_URL + "test.png",
          }}
          className="bg-red-300"
          style={{ width: 96, height: 96 }}
          onError={(err) => {
            const nativeEvent = err.nativeEvent;
            setErrors((prev) => [...prev, JSON.stringify(nativeEvent)]);
          }}
        />
        <Text>User: {user ? JSON.stringify(user) : "No user logged in"}</Text>
        <Text>Debug Fetch Result: {debugFetchResult}</Text>
        <FlatList
          data={errors}
          renderItem={({ item }) => <Text>{item}</Text>}
          keyExtractor={(item, index) => index.toString()}
        />
      </MainView>
    </View>
  );
}
