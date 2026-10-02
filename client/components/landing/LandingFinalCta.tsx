import { useThemeColors } from "@/hooks/useThemeColors";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import AnimatedView from "./AnimatedView";

/** Centered band on navy, final chance to act. */
export default function LandingFinalCta() {
  const colors = useThemeColors();

  return (
    <View
      className="w-full items-center px-5 py-16 lg:py-20"
      style={{ backgroundColor: colors.SECONDARY }}
    >
      <AnimatedView entering={FadeInDown.duration(500)} className="items-center">
        <Text className="max-w-xl text-center text-2xl font-bold text-white lg:text-3xl">
          Sumate a tu comunidad escolar en Loop
        </Text>
        <Text className="mt-3 max-w-md text-center text-sm text-white/80">
          Publicá lo que ya no usás y empezá a loopear con las familias de tu colegio.
        </Text>

        <View className="mt-8 flex-row flex-wrap items-center justify-center gap-3">
          <Link href="/ingresar" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Ingresar a Loop"
              className="rounded-full bg-primary px-7 py-4"
            >
              <Text className="text-center text-sm font-bold text-white">Ingresar</Text>
            </Pressable>
          </Link>
          <Link href="/register" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Crear una cuenta en Loop"
              className="rounded-full border-2 border-white px-7 py-4"
            >
              <Text className="text-center text-sm font-bold text-white">Crear cuenta</Text>
            </Pressable>
          </Link>
        </View>
      </AnimatedView>
    </View>
  );
}
