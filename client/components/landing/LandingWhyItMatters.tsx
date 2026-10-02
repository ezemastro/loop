import { useThemeColors } from "@/hooks/useThemeColors";
import { CO2Icon, LeafIcon, WasteIcon } from "@/components/Icons";
import { Text, View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import AnimatedView from "./AnimatedView";

const REASONS = [
  {
    icon: LeafIcon,
    title: "Materiales que siguen sirviendo",
    text: "Los útiles en buen estado tienen una segunda vida en vez de ir a la basura.",
  },
  {
    icon: WasteIcon,
    title: "Menos residuos, menos gasto",
    text: "Cada loopeo es una compra que una familia no necesita hacer.",
  },
  {
    icon: CO2Icon,
    title: "Impacto medido",
    text: "La app mide el impacto ambiental positivo de cada loopeo.",
  },
];

/** Vertical, icon-led list. Asymmetric widths, not an equal-card row. */
export default function LandingWhyItMatters() {
  const colors = useThemeColors();

  return (
    <View className="w-full px-5 py-16 lg:px-10 lg:py-24">
      <Text
        accessibilityRole="header"
        className="text-center text-2xl font-bold lg:text-3xl"
        style={{ color: colors.MAIN_TEXT }}
      >
        Por qué importa
      </Text>

      <View className="mx-auto mt-10 w-full max-w-2xl gap-6">
        {REASONS.map(({ icon: Icon, title, text }, index) => (
          <AnimatedView
            key={title}
            entering={FadeInDown.duration(450).delay(index * 70)}
            className="flex-row items-start gap-4"
          >
            <View
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.SECONDARY}12` }}
            >
              <Icon color={colors.SECONDARY} size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: colors.MAIN_TEXT }}>
                {title}
              </Text>
              <Text className="mt-1 text-sm" style={{ color: colors.SECONDARY_TEXT }}>
                {text}
              </Text>
            </View>
          </AnimatedView>
        ))}
      </View>
    </View>
  );
}
