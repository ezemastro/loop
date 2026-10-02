import { useThemeColors } from "@/hooks/useThemeColors";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const GROUPS = ["Familias", "Estudiantes", "Docentes", "Personal autorizado"];

/** Compact band, not a card row: who Loop is for and how they join. */
export default function LandingForWhom() {
  const colors = useThemeColors();

  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      className="w-full flex-row flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 py-10 lg:px-10"
      style={{ backgroundColor: colors.BACKGROUND }}
    >
      <Text
        className="w-full max-w-md text-center text-base lg:w-auto lg:max-w-sm lg:text-left"
        style={{ color: colors.MAIN_TEXT }}
      >
        Loop es para toda la comunidad de los colegios de Red Itínere. El registro se hace con tu
        correo institucional.
      </Text>

      <View className="flex-row flex-wrap items-center justify-center gap-3">
        {GROUPS.map((group) => (
          <View key={group} className="rounded-full bg-white px-4 py-2">
            <Text className="text-xs font-semibold" style={{ color: colors.SECONDARY }}>
              {group}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
