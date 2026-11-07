import { EmailIcon, LeafIcon, LockIcon, SettingsIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ComponentType } from "react";
import { View } from "react-native";
import { COMMUNITY_POINTS } from "./content";
import { BODY_TEXT, LANDING_CONTAINER, SECTION_HEADING, SECTION_PADDING } from "./layout";
import Text from "./LandingText";
import Reveal from "./Reveal";

type IconComponent = ComponentType<{ color?: string; size?: number }>;

const POINT_ICONS: Record<string, IconComponent> = {
  acceso: EmailIcon,
  aislamiento: LockIcon,
  panel: SettingsIcon,
  impacto: LeafIcon,
};

/**
 * What each community controls. Heading and lead on the left, a 2x2 grid of points on the right
 * from `lg`; below `lg` it is one column (heading, then the four points stacked). Every claim is
 * backed by code, see `COMMUNITY_POINTS` in `content.ts`.
 */
export default function LandingCommunity() {
  const colors = useThemeColors();

  return (
    <View className={`w-full ${SECTION_PADDING}`} nativeID="comunidad">
      <View className={`${LANDING_CONTAINER} flex-col gap-10 lg:flex-row lg:gap-16`}>
        <Reveal className="w-full min-w-0 lg:w-[22rem] lg:shrink-0">
          <Text accessibilityRole="header" aria-level={2} className={SECTION_HEADING}>
            Una comunidad cerrada, con su propio espacio
          </Text>
          <Text className={`mt-4 text-base leading-relaxed ${BODY_TEXT}`}>
            Cada comunidad escolar tiene su lugar dentro de Loop. Lo que pasa en una no se ve en
            otra, y su equipo decide quién entra.
          </Text>
        </Reveal>

        <View className="w-full min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap lg:flex-1">
          {COMMUNITY_POINTS.map(({ id, title, text }, index) => {
            const Icon = POINT_ICONS[id];
            return (
              <Reveal key={id} step={index} className="w-full sm:w-[calc(50%-0.5rem)]">
                <View className="h-full gap-3 rounded-3xl border border-stroke bg-white p-6">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-secondary/10">
                    <Icon color={colors.SECONDARY} size={22} />
                  </View>
                  <Text className="text-lg font-bold text-main-text">{title}</Text>
                  <Text className={`text-[15px] leading-6 ${BODY_TEXT}`}>{text}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </View>
    </View>
  );
}
