import { useThemeColors } from "@/hooks/useThemeColors";
import { RepeatIcon, StarIcon } from "@/components/Icons";
import { Text, View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import AnimatedView from "./AnimatedView";

const FACTS = [
  {
    icon: StarIcon,
    text: "Los primeros loopies salen de las misiones iniciales, al sumarte a Loop.",
  },
  {
    icon: RepeatIcon,
    text: "Un intercambio puede ser producto por producto, o producto por loopies.",
  },
];

/** Two-column explanation of the internal credit unit. Not a card row. */
export default function LandingLoopies() {
  const colors = useThemeColors();

  return (
    <View
      className="w-full px-5 py-16 lg:px-10 lg:py-24"
      style={{ backgroundColor: colors.BACKGROUND }}
      nativeID="loopies"
    >
      <AnimatedView
        entering={FadeInDown.duration(500)}
        className="mx-auto w-full max-w-5xl flex-row flex-wrap items-start justify-between gap-10 lg:flex-nowrap"
      >
        <View className="w-full min-w-0 max-w-md lg:w-1/2">
          <Text
            accessibilityRole="header"
            className="text-2xl font-bold lg:text-3xl"
            style={{ color: colors.MAIN_TEXT }}
          >
            ¿Qué son los <Text style={{ color: colors.CREDITS }}>loopies</Text>?
          </Text>
          <Text className="mt-4 text-base" style={{ color: colors.SECONDARY_TEXT }}>
            Son la unidad virtual interna de Loop. No tienen valor monetario real y no se pueden
            cobrar: existen solo dentro de la plataforma, para que el intercambio funcione también
            cuando nadie tiene algo para dar en el momento.
          </Text>
        </View>

        <View className="w-full min-w-0 max-w-md gap-4 lg:w-1/2">
          {FACTS.map(({ icon: Icon, text }) => (
            <View key={text} className="flex-row items-start gap-3 rounded-2xl bg-white p-4">
              <View
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${colors.CREDITS}1A` }}
              >
                <Icon color={colors.CREDITS} size={18} />
              </View>
              <Text className="flex-1 text-sm" style={{ color: colors.MAIN_TEXT }}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      </AnimatedView>
    </View>
  );
}
