import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Error from "@/components/Error";

interface SessionRestoreScreenProps {
  failed: boolean;
  onRetry: () => void;
  onLogout: () => void;
}

/**
 * What the root layout shows instead of the navigator while a stored session is restored. It is
 * deliberately plain: it must not look like the landing or the login screen, and it must render
 * without the session (no user, no community theme).
 */
export default function SessionRestoreScreen({
  failed,
  onRetry,
  onLogout,
}: SessionRestoreScreenProps) {
  if (!failed) {
    return (
      <View className="flex-1 items-center justify-center bg-white" accessibilityRole="progressbar">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white p-6">
      <Error textClassName="text-center text-lg font-medium">No pudimos recuperar tu sesión</Error>
      <Text className="text-center text-sm text-main-text">
        Revisá tu conexión e intentá de nuevo. Tu sesión sigue guardada.
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onRetry}
          className="rounded-lg bg-primary px-3 py-1.5 active:opacity-70"
        >
          <Text className="font-semibold text-white">Reintentar</Text>
        </Pressable>
        <Pressable
          onPress={onLogout}
          className="rounded-lg bg-primary px-3 py-1.5 active:opacity-70"
        >
          <Text className="font-semibold text-white">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}
