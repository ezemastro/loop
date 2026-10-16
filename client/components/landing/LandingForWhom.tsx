import { FamilyIcon, StaffIcon, StudentIcon, TeacherIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ComponentType } from "react";
import { Text, View } from "react-native";
import { LANDING_CONTAINER } from "./layout";
import Reveal from "./Reveal";

const GROUPS: { label: string; icon: ComponentType<{ color?: string; size?: number }> }[] = [
  { label: "Familias", icon: FamilyIcon },
  { label: "Estudiantes", icon: StudentIcon },
  { label: "Docentes", icon: TeacherIcon },
  { label: "Personal autorizado", icon: StaffIcon },
];

/**
 * Compact band right under the hero: who Loop is for. The four groups sit in columns split by
 * hairlines (a brochure-style icon row), not in pills.
 */
export default function LandingForWhom() {
  const colors = useThemeColors();

  return (
    <View className="w-full bg-background py-10 lg:py-12">
      <Reveal
        className={`${LANDING_CONTAINER} flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12`}
      >
        <Text className="max-w-[26rem] text-base leading-relaxed text-main-text lg:text-[17px]">
          Loop es para toda la comunidad de los colegios de Red Itínere. Te registrás con tu correo
          institucional.
        </Text>

        <View className="flex-row flex-wrap gap-y-6 lg:flex-nowrap">
          {GROUPS.map(({ label, icon: Icon }, index) => (
            <View
              key={label}
              className={`w-1/2 items-center gap-2.5 px-3 lg:w-auto lg:px-8 ${
                index > 0 ? "lg:border-l lg:border-stroke" : ""
              } ${index % 2 === 1 ? "max-lg:border-l max-lg:border-stroke" : ""}`}
            >
              <Icon color={colors.SECONDARY} size={24} />
              <Text className="text-center text-sm font-semibold text-secondary">{label}</Text>
            </View>
          ))}
        </View>
      </Reveal>
    </View>
  );
}
