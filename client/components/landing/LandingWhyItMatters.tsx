import { CO2Icon, LeafIcon, WasteIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Text, View } from "react-native";
import { BODY_TEXT, LANDING_CONTAINER, SECTION_HEADING, SECTION_PADDING } from "./layout";
import Reveal from "./Reveal";

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

/** Three open columns under a hairline, no cards: the reasons read as one statement. */
export default function LandingWhyItMatters() {
  const colors = useThemeColors();

  return (
    <View className={`w-full ${SECTION_PADDING}`}>
      <View className={LANDING_CONTAINER}>
        <Reveal>
          <Text accessibilityRole="header" className={SECTION_HEADING}>
            Por qué importa
          </Text>
        </Reveal>

        <View className="mt-10 flex-col gap-8 lg:flex-row lg:gap-12">
          {REASONS.map(({ icon: Icon, title, text }, index) => (
            <Reveal
              key={title}
              step={index + 1}
              className="w-full min-w-0 border-t-2 border-secondary/15 pt-6 lg:flex-1"
            >
              <Icon color={colors.TERTIARY} size={26} />
              <Text className="mt-4 text-lg font-bold text-main-text">{title}</Text>
              <Text className={`mt-2 text-[15px] leading-6 ${BODY_TEXT}`}>{text}</Text>
            </Reveal>
          ))}
        </View>
      </View>
    </View>
  );
}
