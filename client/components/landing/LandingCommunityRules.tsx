import { CheckIcon } from "@/components/Icons";
import { Text, View } from "react-native";
import { LANDING_CONTAINER } from "./layout";
import Reveal from "./Reveal";

const RULES = [
  "Red Itínere ofrece la plataforma, pero no interviene en la entrega, la verificación del producto ni en conflictos entre familias.",
  "Cada familia es responsable de describir sus útiles con honestidad y de llegar a acuerdos justos.",
  "Si algo sale mal, se reporta desde la app.",
];

/** Full-bleed navy band: heading on the left, the rules as a hairline-separated list. */
export default function LandingCommunityRules() {
  return (
    <View className="w-full bg-secondary py-16 lg:py-20">
      <View
        className={`${LANDING_CONTAINER} flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-16`}
      >
        <Reveal className="lg:w-[22rem] lg:shrink-0">
          <Text
            accessibilityRole="header"
            className="text-2xl font-bold text-white lg:text-[2rem] lg:leading-[2.5rem]"
          >
            Reglas de la comunidad
          </Text>
        </Reveal>

        <Reveal step={1} className="w-full min-w-0 lg:max-w-[40rem] lg:flex-1">
          {RULES.map((rule, index) => (
            <View
              key={rule}
              className={`flex-row items-start gap-4 py-5 ${
                index > 0 ? "border-t border-white/15" : "lg:pt-2"
              }`}
            >
              <View className="mt-0.5">
                <CheckIcon color="white" size={18} />
              </View>
              <Text className="flex-1 text-base leading-relaxed text-white/90">{rule}</Text>
            </View>
          ))}
        </Reveal>
      </View>
    </View>
  );
}
