import { FamilyIcon, StaffIcon, StudentIcon, TeacherIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import { Image, View } from "react-native";
import { JOIN_GROUPS, SCHOOL_LOGOS } from "./content";
import { LANDING_CONTAINER } from "./layout";
import Text from "./LandingText";
import Reveal from "./Reveal";

type IconComponent = ComponentType<{ color?: string; size?: number }>;

const GROUP_ICONS: Record<(typeof JOIN_GROUPS)[number], IconComponent> = {
  Familias: FamilyIcon,
  Estudiantes: StudentIcon,
  Docentes: TeacherIcon,
  "Personal autorizado": StaffIcon,
};

// Metro needs literal `require` paths, so the logos are listed here instead of built from ids.
const LOGO_SOURCES: Record<string, ImageSourcePropType> = {
  northfield: require("../../assets/landing/schools/northfield.webp"),
  "del-faro": require("../../assets/landing/schools/del-faro.webp"),
  "south-creek": require("../../assets/landing/schools/south-creek.webp"),
  "north-schools": require("../../assets/landing/schools/north-schools.webp"),
  "the-global-school": require("../../assets/landing/schools/the-global-school.webp"),
};

/** Logo box: the sources are 225px squares, so 72px stays sharp at 3x. */
const LOGO_SIZE = 72;

/**
 * Right under the hero: where Loop is available and who can join. Centered stack, not the
 * hero's two columns: heading, the five school brands (logos only, no labels), then the four
 * groups that can join. Below `sm` the logos wrap onto two rows and the groups into a 2x2 grid.
 */
export default function LandingSchools() {
  const colors = useThemeColors();

  return (
    <View className="w-full bg-background py-12 lg:py-16">
      <View className={`${LANDING_CONTAINER} items-center`}>
        <Reveal className="items-center">
          <Text
            accessibilityRole="header"
            aria-level={2}
            className="max-w-[52rem] text-balance text-center text-2xl font-bold text-main-text lg:text-[2rem] lg:leading-[2.5rem]"
          >
            Disponible en todos los colegios de Red Itínere
          </Text>
          <Text className="mt-3 text-center text-base text-main-text/80">
            Nueve sedes en Argentina y Uruguay
          </Text>
        </Reveal>

        <Reveal step={1} className="mt-8 w-full items-center">
          <View className="w-full max-w-[48rem] flex-row flex-wrap items-center justify-center gap-x-4 gap-y-4 lg:flex-nowrap lg:gap-x-6">
            {SCHOOL_LOGOS.map(({ id, name }) => (
              <View
                key={id}
                className="items-center justify-center rounded-2xl border border-stroke bg-white p-3"
              >
                <Image
                  source={LOGO_SOURCES[id]}
                  accessibilityLabel={name}
                  role="img"
                  resizeMode="contain"
                  style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
                />
              </View>
            ))}
          </View>
        </Reveal>

        <Reveal step={2} className="mt-10 w-full items-center border-t border-stroke pt-8">
          <Text className="text-center text-base text-main-text/80">
            Pueden sumarse con su correo institucional
          </Text>
          <View className="mt-6 w-full max-w-[40rem] flex-row flex-wrap justify-center gap-y-6 lg:flex-nowrap">
            {JOIN_GROUPS.map((label, index) => {
              const Icon = GROUP_ICONS[label];
              return (
                <View
                  key={label}
                  className={`w-1/2 items-center gap-2.5 px-3 lg:w-auto lg:flex-1 ${
                    index % 2 === 1 ? "max-lg:border-l max-lg:border-stroke" : ""
                  } ${index > 0 ? "lg:border-l lg:border-stroke" : ""}`}
                >
                  <Icon color={colors.SECONDARY} size={24} />
                  <Text className="text-center text-sm font-semibold text-secondary">{label}</Text>
                </View>
              );
            })}
          </View>
        </Reveal>
      </View>
    </View>
  );
}
