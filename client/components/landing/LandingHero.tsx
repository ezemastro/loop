import { TapIcon } from "@/components/Icons";
import { useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Image, Text, View } from "react-native";
import { LaptopShell, PHONE_VIEWPORT, PhoneShell, ScreenImage } from "./DeviceFrame";
import LandingButton from "./LandingButton";
import { BODY_TEXT, LANDING_CONTAINER } from "./layout";
import Reveal from "./Reveal";
import { LIVE_DEMO_SRC, useLiveDemo } from "./useLiveDemo";

type Props = {
  phoneSource: ImageSourcePropType;
  desktopSource: ImageSourcePropType;
};

const PHONE_ALT = "Pantalla de inicio de Loop en el celular";

/**
 * Brochure-style hero: copy on the left, and on the right a laptop with Loop's desktop home plus
 * a phone running the REAL app (the `/demo` route in an iframe, see `useLiveDemo`). The devices
 * sit across the edge of a navy color block that bleeds to the right edge of the viewport.
 *
 * Below `lg` the composition gives way to a single static phone capture: a live phone inside a
 * phone makes no sense, and it keeps the small-screen hero light.
 */
export default function LandingHero({ phoneSource, desktopSource }: Props) {
  return (
    <View className="relative w-full overflow-hidden">
      {/* Color block: starts a little right of center so the laptop straddles its edge. */}
      <View className="absolute bottom-10 right-0 top-10 left-[calc(50%+7.5rem)] rounded-l-3xl bg-secondary max-lg:hidden" />

      <View
        className={`${LANDING_CONTAINER} relative flex-col gap-10 pb-12 pt-10 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:py-20`}
      >
        <View className="w-full min-w-0 items-start lg:w-[440px] lg:shrink-0 xl:w-[500px]">
          <View className="flex-row items-center gap-2.5">
            <Text className="text-sm text-main-text/70">Una plataforma de</Text>
            <Image
              source={require("../../assets/reditinere_logo.png")}
              accessibilityLabel="Red Itínere"
              resizeMode="contain"
              style={{ width: 80, height: 26 }}
            />
          </View>

          <Text
            accessibilityRole="header"
            aria-level={1}
            className="mt-6 text-[2rem] font-bold leading-[2.5rem] text-main-text lg:text-[2.125rem] lg:leading-[2.6rem] xl:text-[2.5rem] xl:leading-[3rem]"
          >
            Dale una <Text className="text-secondary">segunda vida</Text> a los{" "}
            <Text className="text-primary">útiles</Text> de tu colegio
          </Text>

          <Text className={`mt-4 max-w-[30rem] text-base leading-relaxed lg:text-lg ${BODY_TEXT}`}>
            Intercambiá lo que ya no usás por lo que tu familia necesita, dentro de la comunidad de
            tu colegio.
          </Text>

          <View className="mt-8 flex-row flex-wrap items-center gap-3">
            <LandingButton href="/ingresar" label="Ingresar" accessibilityLabel="Ingresar a Loop" />
            <LandingButton
              href="/register"
              label="Crear cuenta"
              accessibilityLabel="Crear una cuenta en Loop"
              variant="secondary"
            />
          </View>
        </View>

        {/* Small screens: one static phone on a navy panel. */}
        <View className="w-full items-center rounded-3xl bg-secondary px-6 py-10 lg:hidden">
          <PhoneShell screenClassName="w-[220px]">
            <ScreenImage source={phoneSource} alt={PHONE_ALT} />
          </PhoneShell>
        </View>

        {/* lg and up: laptop + live phone. */}
        <View className="items-center max-lg:hidden lg:grow lg:basis-0">
          <HeroDevices phoneSource={phoneSource} desktopSource={desktopSource} />
        </View>
      </View>
    </View>
  );
}

function HeroDevices({ phoneSource, desktopSource }: Props) {
  const { mounted, state, touched, frameRef, onFrameLoad } = useLiveDemo();
  const [screenWidth, setScreenWidth] = useState(0);
  const live = state === "live";
  const scale = screenWidth / PHONE_VIEWPORT.width;

  return (
    // Fixed composition box per breakpoint: laptop on the left, phone overlapping its right side.
    <View className="relative h-[490px] w-[464px] xl:h-[556px] xl:w-[576px]">
      <Reveal className="absolute left-0 top-[112px] xl:top-[134px]">
        <LaptopShell
          source={desktopSource}
          alt="Inicio de Loop en una computadora"
          className="w-[360px] xl:w-[440px]"
        />
      </Reveal>

      <Reveal step={2} className="absolute right-0 top-0">
        <View className="transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <PhoneShell screenClassName="w-[200px] xl:w-[230px]">
            <View
              className="absolute inset-0"
              onLayout={(event) => setScreenWidth(event.nativeEvent.layout.width)}
            />
            <ScreenImage
              source={phoneSource}
              alt={PHONE_ALT}
              className={`transition-opacity duration-500 ${live ? "opacity-0" : "opacity-100"}`}
            />
            {mounted && scale > 0 ? (
              <iframe
                ref={frameRef}
                src={LIVE_DEMO_SRC}
                title="Demo interactiva de Loop: la app real, con datos de ejemplo"
                onLoad={onFrameLoad}
                tabIndex={live ? 0 : -1}
                aria-hidden={!live}
                className={`absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500 motion-reduce:transition-none ${
                  live ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                style={{
                  width: PHONE_VIEWPORT.width,
                  height: PHONE_VIEWPORT.height,
                  transform: `scale(${scale})`,
                }}
              />
            ) : null}
          </PhoneShell>
        </View>

        <View
          aria-hidden={!live || touched}
          className={`mt-4 flex-row items-center justify-center gap-2 transition-opacity duration-500 motion-reduce:transition-none ${
            live && !touched ? "opacity-100" : "opacity-0"
          }`}
        >
          <TapIcon color="white" size={18} />
          <Text className="text-sm font-semibold text-white">Probala acá</Text>
        </View>
      </Reveal>
    </View>
  );
}
