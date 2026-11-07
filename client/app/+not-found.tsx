import { Text, View } from "react-native";
import { router } from "expo-router";
import Head from "expo-router/head";
import ButtonText from "@/components/bases/ButtonText";
import CustomButton from "@/components/bases/CustomButton";
import { useAuth } from "@/hooks/useAuth";

/**
 * Replaces expo-router's default English "Unmatched Route" screen (black, with a Sitemap link).
 *
 * `/` only exists for logged-out visitors (`(auth)/index`), so a logged-in user is sent to the
 * home tab instead; `Stack.Protected` would otherwise bounce them anyway.
 */
export default function NotFound() {
  const { isLoggedIn } = useAuth();

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Head>
        <title>Página no encontrada - Loop</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Text
        accessibilityRole="header"
        className="text-center text-2xl font-semibold text-main-text"
      >
        No encontramos esta página
      </Text>
      <Text className="max-w-md text-center text-base text-secondary-text">
        Puede que el enlace esté mal escrito o que la página ya no exista.
      </Text>
      <CustomButton
        onPress={() => router.replace(isLoggedIn ? "/(main)/(tabs)/home" : "/")}
        className="mt-2 max-w-xs"
      >
        <ButtonText>Volver al inicio</ButtonText>
      </CustomButton>
    </View>
  );
}
