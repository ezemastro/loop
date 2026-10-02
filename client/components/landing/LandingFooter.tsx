import { useThemeColors } from "@/hooks/useThemeColors";
import { Link } from "expo-router";
import { Image, View } from "react-native";
import { CONSULTAS_FORM_URL } from "./content";

/** Multi-column footer: logo, legal links, contact form. */
export default function LandingFooter() {
  const colors = useThemeColors();

  return (
    <View className="w-full border-t px-5 py-10 lg:px-10" style={{ borderColor: colors.STROKE }}>
      <View className="mx-auto w-full max-w-5xl flex-col items-center gap-6 lg:flex-row lg:justify-between">
        <Image
          source={require("../../assets/reditinere_logo.png")}
          accessibilityLabel="Red Itínere"
          resizeMode="contain"
          style={{ width: 88, height: 29 }}
        />

        <View className="w-full flex-row flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:w-auto lg:justify-end">
          <Link href="/privacidad" className="text-sm" style={{ color: colors.SECONDARY_TEXT }}>
            Privacidad
          </Link>
          <Link href="/terminos" className="text-sm" style={{ color: colors.SECONDARY_TEXT }}>
            Términos
          </Link>
          <Link href="/borrar-cuenta" className="text-sm" style={{ color: colors.SECONDARY_TEXT }}>
            Borrar mi cuenta
          </Link>
          <Link
            // External URL: expo-router's typed `href` accepts it as `ExternalPathString`
            // (anything containing `://`), and renders a real `<a target="_blank">` on web.
            href={CONSULTAS_FORM_URL}
            target="_blank"
            className="text-sm"
            style={{ color: colors.SECONDARY_TEXT }}
          >
            Buzón de consultas
          </Link>
        </View>
      </View>
    </View>
  );
}
