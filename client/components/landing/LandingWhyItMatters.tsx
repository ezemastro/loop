import { CO2Icon, LeafIcon, WasteIcon } from "@/components/Icons";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ComponentType } from "react";
import type { ImageSourcePropType } from "react-native";
import { Image, View } from "react-native";
import { BODY_TEXT, LANDING_CONTAINER, SECTION_HEADING, SECTION_PADDING } from "./layout";
import Text from "./LandingText";
import Reveal from "./Reveal";

type IconComponent = ComponentType<{ color?: string; size?: number }>;

const REASONS: { icon: IconComponent; title: string; text: string }[] = [
  {
    icon: LeafIcon,
    title: "Materiales que siguen sirviendo",
    text: "Los útiles en buen estado tienen una segunda vida en vez de ir a la basura.",
  },
  {
    icon: WasteIcon,
    title: "Menos residuos, menos gasto",
    text: "Cada útil que cambia de manos es una compra nueva que una familia no tiene que hacer.",
  },
  {
    icon: CO2Icon,
    title: "Impacto ambiental registrado",
    text: "Cada intercambio confirmado suma al impacto de la comunidad: residuos evitados, CO2 y agua ahorrada.",
  },
];

/** Real product photos bundled for the demo data (`assets/demo/listings`, credits in CREDITS.md). */
const PHOTOS: Record<string, { source: ImageSourcePropType; alt: string }> = {
  mochila: {
    source: require("../../assets/demo/listings/loop-demo-mochila-1.webp"),
    alt: "Mochila azul con una botella amarilla, apoyada en el pasto",
  },
  cuadernos: {
    source: require("../../assets/demo/listings/loop-demo-cuadernos.webp"),
    alt: "Pila de cuadernos y libros de colores",
  },
  botella: {
    source: require("../../assets/demo/listings/loop-demo-botella.webp"),
    alt: "Botella de agua reutilizable gris",
  },
};

/** Photo frame with a fixed aspect ratio; the image fills it edge to edge, nothing on top of it. */
function Photo({
  photo,
  aspectClassName,
}: {
  photo: { source: ImageSourcePropType; alt: string };
  aspectClassName: string;
}) {
  return (
    <View className={`w-full overflow-hidden rounded-3xl bg-background ${aspectClassName}`}>
      <Image
        source={photo.source}
        accessibilityLabel={photo.alt}
        role="img"
        resizeMode="cover"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}

/**
 * The reasons as a short editorial list next to a staggered photo pair: one tall photo dropped
 * to the bottom of the row against a square one stacked over a portrait one, so the two columns
 * end flush. Below `lg` the text comes first and the photos follow, still as two columns.
 */
export default function LandingWhyItMatters() {
  const colors = useThemeColors();

  return (
    <View className={`w-full ${SECTION_PADDING}`}>
      <View
        className={`${LANDING_CONTAINER} flex-col gap-12 lg:flex-row lg:items-center lg:gap-20`}
      >
        <View className="w-full min-w-0 lg:flex-1">
          <Reveal>
            <Text accessibilityRole="header" aria-level={2} className={SECTION_HEADING}>
              Por qué importa
            </Text>
          </Reveal>

          <View className="mt-8">
            {REASONS.map(({ icon: Icon, title, text }, index) => (
              <Reveal
                key={title}
                step={index + 1}
                className="flex-row items-start gap-4 border-t border-stroke py-6"
              >
                <View className="mt-0.5 h-11 w-11 items-center justify-center rounded-full bg-secondary/10">
                  <Icon color={colors.SECONDARY} size={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-lg font-bold text-main-text">{title}</Text>
                  <Text className={`mt-1.5 text-[15px] leading-6 ${BODY_TEXT}`}>{text}</Text>
                </View>
              </Reveal>
            ))}
          </View>
        </View>

        <Reveal step={2} className="w-full lg:w-[26rem] lg:shrink-0">
          <View className="w-full flex-row items-stretch gap-3 lg:gap-4">
            <View className="min-w-0 flex-1 justify-end">
              <Photo photo={PHOTOS.mochila} aspectClassName="aspect-[2/3]" />
            </View>
            <View className="min-w-0 flex-1 gap-3 lg:gap-4">
              <Photo photo={PHOTOS.cuadernos} aspectClassName="aspect-square" />
              <Photo photo={PHOTOS.botella} aspectClassName="aspect-[4/5]" />
            </View>
          </View>
        </Reveal>
      </View>
    </View>
  );
}
