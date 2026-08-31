import { Pressable, Text, View } from "react-native";
import { useSessionStore } from "@/stores/session";

/**
 * Aviso permanente de que la sesión es simulada.
 *
 * Va en el flujo normal del layout, debajo del header, y no flotando: así empuja el contenido en
 * vez de taparlo, y no hay pantalla donde pueda quedar encima de un botón.
 *
 * Existe porque sin él la demo es indistinguible de la app real. Alguien que entró, cerró y volvió
 * dos días después vería datos que no son suyos creyendo que sí lo son — y ese malentendido cuesta
 * mucho más caro que una franja de 30 píxeles.
 */
export default function DemoModeBanner() {
  const demoMode = useSessionStore((state) => state.demoMode);
  const logout = useSessionStore((state) => state.logout);

  if (!demoMode) return null;

  return (
    <View className="flex-row items-center justify-between gap-3 bg-secondary px-4 py-2">
      <Text className="flex-1 text-sm font-medium text-white">
        Modo demo: datos de ejemplo. Nada de lo que hagas se guarda.
      </Text>
      <Pressable
        onPress={logout}
        accessibilityRole="button"
        accessibilityLabel="Salir del modo demo"
        className="rounded border border-white/70 px-3 py-1"
      >
        <Text className="text-sm font-semibold text-white">Salir</Text>
      </Pressable>
    </View>
  );
}
