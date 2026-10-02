import { useThemeColors } from "@/hooks/useThemeColors";
import { Text, View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import AnimatedView from "./AnimatedView";

const RULES = [
  "Red Itínere ofrece la plataforma, pero no interviene en la entrega, la verificación del producto ni en conflictos entre familias.",
  "Cada familia es responsable de describir sus útiles con honestidad y de llegar a acuerdos justos.",
  "Si algo sale mal, se reporta desde la app.",
];

/** Single bordered block on a dark navy tint: headings/dark-block accent logic. */
export default function LandingCommunityRules() {
  const colors = useThemeColors();

  return (
    <View
      className="w-full px-5 py-16 lg:px-10 lg:py-20"
      style={{ backgroundColor: colors.SECONDARY }}
    >
      <AnimatedView entering={FadeInDown.duration(500)} className="mx-auto w-full max-w-[42rem]">
        <Text
          accessibilityRole="header"
          className="text-center text-2xl font-bold text-white lg:text-3xl"
        >
          Reglas de la comunidad
        </Text>

        <View className="mt-8 gap-4 rounded-3xl bg-white/10 p-6 lg:p-8">
          {RULES.map((rule) => (
            <View key={rule} className="flex-row items-start gap-3">
              <View className="mt-2 h-1.5 w-1.5 rounded-full bg-white" />
              <Text className="flex-1 text-sm text-white/90 lg:text-base">{rule}</Text>
            </View>
          ))}
        </View>
      </AnimatedView>
    </View>
  );
}
