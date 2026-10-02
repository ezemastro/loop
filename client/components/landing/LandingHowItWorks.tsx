import { useThemeColors } from "@/hooks/useThemeColors";
import type { ImageSourcePropType } from "react-native";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { HOW_IT_WORKS_STEPS } from "./content";
import { PhoneFrame } from "./DeviceFrame";

type Props = {
  stepScreenshots: Partial<Record<string, ImageSourcePropType>>;
};

/** Stepped, alternating layout: copy and screenshot swap sides per step. No equal-card row. */
export default function LandingHowItWorks({ stepScreenshots }: Props) {
  const colors = useThemeColors();

  return (
    <View className="w-full px-5 py-16 lg:px-10 lg:py-24" nativeID="como-funciona">
      <Text
        accessibilityRole="header"
        className="text-center text-2xl font-bold lg:text-3xl"
        style={{ color: colors.MAIN_TEXT }}
      >
        Cómo funciona
      </Text>

      <View className="mt-12 gap-14">
        {HOW_IT_WORKS_STEPS.map((step, index) => {
          const screenshot = stepScreenshots[step.id];
          const reverse = index % 2 === 1;

          return (
            <Animated.View
              key={step.id}
              entering={FadeInDown.duration(500).delay(index * 80)}
              className={`mx-auto w-full max-w-5xl flex-row flex-wrap items-center justify-center gap-8 lg:flex-nowrap lg:justify-between ${
                reverse ? "lg:flex-row-reverse" : ""
              }`}
            >
              <View className="w-full max-w-md items-start lg:w-1/2">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${colors.PRIMARY}1A` }}
                >
                  <Text className="font-bold" style={{ color: colors.PRIMARY }}>
                    {index + 1}
                  </Text>
                </View>
                <Text className="mt-4 text-xl font-bold" style={{ color: colors.MAIN_TEXT }}>
                  {step.title}
                </Text>
                <Text className="mt-2 text-base" style={{ color: colors.SECONDARY_TEXT }}>
                  {step.description}
                </Text>
              </View>

              {screenshot ? (
                <View className="max-lg:hidden items-center lg:w-1/2">
                  <PhoneFrame
                    source={screenshot}
                    alt={`Pantalla de Loop: ${step.title}`}
                    width={220}
                  />
                </View>
              ) : null}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
