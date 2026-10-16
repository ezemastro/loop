import { CreditIcon, PublishIcon, RepeatIcon, SearchIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ComponentType } from "react";
import { useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Pressable, Text, View } from "react-native";
import { HOW_IT_WORKS_STEPS } from "./content";
import { PhoneShell, ScreenImage } from "./DeviceFrame";
import {
  BODY_TEXT,
  FOCUS_RING,
  LANDING_CONTAINER,
  SECTION_HEADING,
  SECTION_PADDING,
} from "./layout";
import Reveal from "./Reveal";

type Props = {
  /** One real capture per step id (`content.ts`'s `HOW_IT_WORKS_STEPS`). */
  stepScreenshots: Record<string, ImageSourcePropType>;
};

type IconProps = { color?: string; size?: number };

// `CreditIcon` is the loopies coin image (no `color`), every other icon takes the theme color.
const STEP_ICONS: Record<string, ComponentType<IconProps>> = {
  publicar: PublishIcon,
  recibir: CreditIcon,
  buscar: SearchIcon,
  coordinar: RepeatIcon,
};

/**
 * Steps on one side, ONE phone on the other that shows the capture of the active step. On the web
 * a step activates on hover, focus or press; on small screens the list collapses to titles
 * (only the active step shows its description) with the phone right below it.
 */
export default function LandingHowItWorks({ stepScreenshots }: Props) {
  const colors = useThemeColors();
  const [activeId, setActiveId] = useState(HOW_IT_WORKS_STEPS[0].id);
  const activeStep = HOW_IT_WORKS_STEPS.find((step) => step.id === activeId)!;

  return (
    <View className={`w-full ${SECTION_PADDING}`} nativeID="como-funciona">
      <View className={LANDING_CONTAINER}>
        <Reveal>
          <Text accessibilityRole="header" className={SECTION_HEADING}>
            Cómo funciona
          </Text>
          <Text className={`mt-3 max-w-[34rem] text-base ${BODY_TEXT}`}>
            Cuatro pasos, siempre dentro de la comunidad de tu colegio.
          </Text>
        </Reveal>

        <View className="mt-10 flex-col gap-10 lg:mt-12 lg:flex-row lg:items-center lg:gap-16">
          <Reveal step={1} className="w-full min-w-0 lg:flex-1">
            <View accessibilityRole="tablist" className="gap-2">
              {HOW_IT_WORKS_STEPS.map((step) => {
                const active = step.id === activeId;
                const StepIcon = STEP_ICONS[step.id];
                return (
                  <Pressable
                    key={step.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={step.title}
                    onPress={() => setActiveId(step.id)}
                    onHoverIn={() => setActiveId(step.id)}
                    onFocus={() => setActiveId(step.id)}
                    className={`flex-row items-start gap-4 rounded-3xl border px-5 py-4 transition-colors duration-200 lg:px-6 lg:py-5 ${FOCUS_RING} ${
                      active
                        ? "border-stroke bg-background/60"
                        : "border-transparent hover:bg-background/40"
                    }`}
                  >
                    <View
                      className={`h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 ${
                        active ? "bg-secondary" : "bg-background"
                      }`}
                    >
                      {StepIcon ? (
                        <StepIcon color={active ? "white" : colors.SECONDARY} size={20} />
                      ) : null}
                    </View>
                    <View className="min-w-0 flex-1 pt-2.5">
                      <Text
                        className={`text-lg font-bold leading-6 transition-colors duration-200 ${
                          active ? "text-secondary" : "text-main-text"
                        }`}
                      >
                        {step.title}
                      </Text>
                      <Text
                        className={`mt-1.5 text-[15px] leading-6 ${BODY_TEXT} ${active ? "" : "max-lg:hidden"}`}
                      >
                        {step.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Reveal>

          <Reveal step={2} className="w-full items-center lg:w-auto">
            <View className="w-full items-center rounded-3xl bg-background px-6 py-10 lg:w-[400px] xl:w-[440px]">
              <PhoneShell screenClassName="w-[220px] xl:w-[240px]">
                {HOW_IT_WORKS_STEPS.map((step) => {
                  const source = stepScreenshots[step.id];
                  if (!source) return null;
                  const active = step.id === activeId;
                  return (
                    <ScreenImage
                      key={step.id}
                      source={source}
                      alt={active ? `Pantalla de Loop: ${activeStep.title}` : ""}
                      className={`transition-opacity duration-300 motion-reduce:transition-none ${
                        active ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  );
                })}
              </PhoneShell>
            </View>
          </Reveal>
        </View>
      </View>
    </View>
  );
}
