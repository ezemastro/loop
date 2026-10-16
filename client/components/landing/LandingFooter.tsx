import { Link } from "expo-router";
import { Image, View } from "react-native";
import { CONSULTAS_FORM_URL } from "./content";
import { FOCUS_RING, LANDING_CONTAINER } from "./layout";

const LINK_CLASS = `rounded-sm text-sm text-main-text/70 underline-offset-4 transition-colors duration-200 hover:text-secondary hover:underline ${FOCUS_RING}`;

/** Logos on the left, legal links and the contact form on the right. */
export default function LandingFooter() {
  return (
    <View className="w-full border-t border-stroke py-10">
      <View
        className={`${LANDING_CONTAINER} flex-col items-center gap-6 lg:flex-row lg:justify-between`}
      >
        <View className="flex-row items-center gap-5">
          <Image
            source={require("../../assets/full_logo.png")}
            accessibilityLabel="Loop"
            resizeMode="contain"
            style={{ width: 74, height: 20 }}
          />
          <View className="h-6 w-px bg-stroke" />
          <Image
            source={require("../../assets/reditinere_logo.png")}
            accessibilityLabel="Red Itínere"
            resizeMode="contain"
            style={{ width: 80, height: 26 }}
          />
        </View>

        <View className="w-full flex-row flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:w-auto lg:justify-end">
          <Link href="/privacidad" className={LINK_CLASS}>
            Privacidad
          </Link>
          <Link href="/terminos" className={LINK_CLASS}>
            Términos
          </Link>
          <Link href="/borrar-cuenta" className={LINK_CLASS}>
            Borrar mi cuenta
          </Link>
          <Link
            // External URL: expo-router's typed `href` accepts it as `ExternalPathString`
            // (anything containing `://`), and renders a real `<a target="_blank">` on web.
            href={CONSULTAS_FORM_URL}
            target="_blank"
            className={LINK_CLASS}
          >
            Buzón de consultas
          </Link>
        </View>
      </View>
    </View>
  );
}
