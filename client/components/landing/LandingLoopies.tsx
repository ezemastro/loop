import { CheckIcon, CreditIcon, RepeatIcon, StarIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { View } from "react-native";
import Text from "./LandingText";
import { BODY_TEXT, LANDING_CONTAINER, SECTION_HEADING, SECTION_PADDING } from "./layout";
import Reveal from "./Reveal";

const FACTS = [
  {
    icon: StarIcon,
    text: "Las misiones te dan tus primeros loopies, por ejemplo al publicar tus primeros artículos o completar tu perfil.",
  },
  {
    icon: RepeatIcon,
    text: "Un intercambio puede ser producto por producto, o producto por loopies.",
  },
  {
    icon: CheckIcon,
    text: "Los loopies de un intercambio llegan a quien entrega cuando la otra familia confirma que recibió el artículo.",
  },
];

/** Two columns: what loopies are, and three facts about earning and spending them. */
export default function LandingLoopies() {
  const colors = useThemeColors();

  return (
    <View className={`w-full bg-background ${SECTION_PADDING}`} nativeID="loopies">
      <View
        className={`${LANDING_CONTAINER} flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16`}
      >
        <Reveal className="w-full min-w-0 lg:w-auto lg:max-w-[32rem] lg:flex-1">
          <View className="flex-row items-center gap-3">
            <CreditIcon size={36} />
            <Text accessibilityRole="header" aria-level={2} className={SECTION_HEADING}>
              ¿Qué son los <Text className="text-credits">loopies</Text>?
            </Text>
          </View>
          <Text className={`mt-4 text-base leading-relaxed ${BODY_TEXT}`}>
            Son la unidad virtual interna de Loop. No tienen valor monetario real y no se pueden
            cobrar: existen solo dentro de la plataforma, para que el intercambio funcione también
            cuando nadie tiene algo para dar en el momento.
          </Text>
        </Reveal>

        <View className="w-full min-w-0 gap-4 lg:w-auto lg:max-w-[30rem] lg:flex-1">
          {FACTS.map(({ icon: Icon, text }, index) => (
            <Reveal key={text} step={index + 1}>
              <View className="flex-row items-center gap-4 rounded-3xl border border-stroke bg-white p-5 transition-colors duration-200 hover:border-credits/40">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-credits/10">
                  <Icon color={colors.CREDITS} size={20} />
                </View>
                <Text className="flex-1 text-[15px] leading-6 text-main-text">{text}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </View>
    </View>
  );
}
