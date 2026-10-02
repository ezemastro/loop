import { CreditIcon, PublishIcon, RepeatIcon, SearchIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import { Text, View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import AnimatedView from "./AnimatedView";
import { HOW_IT_WORKS_STEPS } from "./content";
import { BrowserFrame, PhoneFrame } from "./DeviceFrame";

type Props = {
  stepScreenshots: Partial<Record<string, ImageSourcePropType>>;
  desktopSource?: ImageSourcePropType;
};

// One real icon per step instead of a numbered badge: avoids a "01, 02, 03" decorative-number
// pattern while still giving every step, including the three without a screenshot, a visual.
const STEP_ICONS: Record<string, ComponentType<{ color?: string; size?: number }>> = {
  publicar: PublishIcon,
  recibir: CreditIcon,
  buscar: SearchIcon,
  coordinar: RepeatIcon,
};

/** Stepped, alternating layout: copy and screenshot swap sides per step. No equal-card row. */
export default function LandingHowItWorks({ stepScreenshots, desktopSource }: Props) {
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

      {desktopSource ? (
        // Plain `View`, not `AnimatedView`: this block carries `max-lg:hidden` (a
        // display:none media-query class) on the animated element itself, which breaks
        // Reanimated's web entrance animation (it mounts hidden-by-default and the
        // FadeInDown keyframe never resolves past a near-zero opacity once the media query
        // later shows it). Every other entrance in this file stays visible at every
        // breakpoint; only its non-animated screenshot child is conditionally hidden.
        <View className="mx-auto mt-10 w-full max-w-[48rem] items-center max-lg:hidden">
          <BrowserFrame source={desktopSource} alt="Inicio de Loop en la web" width={720} />
        </View>
      ) : null}

      <View className="mt-12 gap-14">
        {HOW_IT_WORKS_STEPS.map((step, index) => {
          const screenshot = stepScreenshots[step.id];
          const reverse = index % 2 === 1;
          const StepIcon = STEP_ICONS[step.id];

          return (
            <AnimatedView
              key={step.id}
              entering={FadeInDown.duration(500).delay(index * 80)}
              className={`mx-auto w-full max-w-5xl flex-row flex-wrap items-center justify-center gap-8 lg:flex-nowrap ${
                screenshot ? "lg:justify-between" : "lg:justify-center"
              } ${reverse ? "lg:flex-row-reverse" : ""}`}
            >
              <View
                className={`w-full min-w-0 max-w-md items-start ${screenshot ? "lg:w-1/2" : ""}`}
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${colors.PRIMARY}1A` }}
                >
                  {StepIcon ? <StepIcon color={colors.PRIMARY} size={20} /> : null}
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
            </AnimatedView>
          );
        })}
      </View>
    </View>
  );
}
