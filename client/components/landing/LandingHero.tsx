import { useThemeColors } from "@/hooks/useThemeColors";
import { Link } from "expo-router";
import type { ImageSourcePropType } from "react-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { PhoneFrame } from "./DeviceFrame";

type Props = {
  phoneSource?: ImageSourcePropType;
};

export default function LandingHero({ phoneSource }: Props) {
  const colors = useThemeColors();

  return (
    <View className="w-full flex-row flex-wrap items-center justify-center gap-10 px-5 py-14 lg:flex-nowrap lg:justify-between lg:px-10 lg:py-24">
      <Animated.View
        entering={FadeInDown.duration(500)}
        className="w-full max-w-xl items-start lg:w-1/2"
      >
        <View className="flex-row items-center gap-2 self-start rounded-full bg-secondary/10 px-4 py-2">
          <Text className="text-xs font-semibold" style={{ color: colors.SECONDARY }}>
            Red Itínere
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          className="mt-5 text-left font-bold"
          style={{ color: colors.MAIN_TEXT, fontSize: 38, lineHeight: 44 }}
        >
          Dale una <Text style={{ color: colors.SECONDARY }}>segunda vida</Text> a los{" "}
          <Text style={{ color: colors.PRIMARY }}>útiles</Text> de tu colegio
        </Text>

        <Text className="mt-4 text-left text-base" style={{ color: colors.SECONDARY_TEXT }}>
          Intercambiá lo que ya no usás por lo que tu familia necesita, dentro de la comunidad de tu
          colegio.
        </Text>

        <View className="mt-8 flex-row flex-wrap items-center gap-3">
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
              className="rounded-full border-2 px-7 py-4"
              style={{ borderColor: colors.TERTIARY }}
            >
              <Text className="text-center text-sm font-bold" style={{ color: colors.TERTIARY }}>
                Crear cuenta
              </Text>
            </Pressable>
          </Link>
        </View>
      </Animated.View>

      {phoneSource ? (
        <Animated.View
          entering={FadeInDown.duration(600).delay(120)}
          className="max-lg:hidden items-center lg:w-1/2"
        >
          <PhoneFrame source={phoneSource} alt="Pantalla de inicio de Loop" width={260} />
        </Animated.View>
      ) : null}
    </View>
  );
}
