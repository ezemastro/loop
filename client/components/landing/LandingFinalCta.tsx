import { Text, View } from "react-native";
import LandingButton from "./LandingButton";
import { LANDING_CONTAINER } from "./layout";
import Reveal from "./Reveal";

/** Closing panel: the same navy block as the hero, contained, with the two page actions. */
export default function LandingFinalCta() {
  return (
    <View className="w-full pb-16 lg:pb-24">
      <View className={LANDING_CONTAINER}>
        <Reveal className="items-center rounded-3xl bg-secondary px-6 py-14 lg:py-16">
          <Text
            accessibilityRole="header"
            className="max-w-[44rem] text-center text-2xl font-bold text-white lg:text-[2rem] lg:leading-[2.5rem]"
          >
            Sumate a tu comunidad escolar en Loop
          </Text>
          <Text className="mt-3 max-w-[28rem] text-center text-base leading-relaxed text-white/85">
            Publicá lo que ya no usás y empezá a loopear con las familias de tu colegio.
          </Text>

          <View className="mt-8 flex-row flex-wrap items-center justify-center gap-3">
            <LandingButton href="/ingresar" label="Ingresar" accessibilityLabel="Ingresar a Loop" />
            <LandingButton
              href="/register"
              label="Crear cuenta"
              accessibilityLabel="Crear una cuenta en Loop"
              variant="inverse"
            />
          </View>
        </Reveal>
      </View>
    </View>
  );
}
