import { useEffect, useMemo, type ReactNode } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { vars } from "nativewind";
import { DEFAULT_COLORS } from "@/config";
import { hexToChannels } from "@/services/color";
import { useActiveTheme } from "@/stores/theme";

/**
 * Inyecta la paleta de la comunidad activa como variables CSS. Es lo que hace que las ~230 clases
 * de color ya escritas (`bg-primary`, `border-stroke/30`, …) cambien de color sin tocarlas: las
 * clases quedan compiladas contra `var(--color-*)` y acá se define el valor.
 *
 * Para valores que viajan como props de JS (tintes de tabs, `placeholderTextColor`, íconos) las
 * variables no sirven; para eso está `useThemeColors()`.
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const colors = useActiveTheme();

  const themeVars = useMemo(
    () =>
      vars({
        "--color-primary": hexToChannels(colors.PRIMARY, DEFAULT_COLORS.PRIMARY),
        "--color-secondary": hexToChannels(colors.SECONDARY, DEFAULT_COLORS.SECONDARY),
        "--color-tertiary": hexToChannels(colors.TERTIARY, DEFAULT_COLORS.TERTIARY),
        "--color-main-text": hexToChannels(colors.MAIN_TEXT, DEFAULT_COLORS.MAIN_TEXT),
        "--color-secondary-text": hexToChannels(
          colors.SECONDARY_TEXT,
          DEFAULT_COLORS.SECONDARY_TEXT,
        ),
        "--color-credits": hexToChannels(colors.CREDITS, DEFAULT_COLORS.CREDITS),
        "--color-credits-light": hexToChannels(colors.CREDITS_LIGHT, DEFAULT_COLORS.CREDITS_LIGHT),
        "--color-stroke": hexToChannels(colors.STROKE, DEFAULT_COLORS.STROKE),
        "--color-background": hexToChannels(colors.BACKGROUND, DEFAULT_COLORS.BACKGROUND),
        "--color-alert": hexToChannels(colors.ALERT, DEFAULT_COLORS.ALERT),
      }) as ViewStyle,
    [colors],
  );

  // El `themeColor` de `app.json` se hornea en el manifest al exportar, así que la barra del
  // navegador queda con el color de la comunidad equivocada. Se parchea en runtime.
  // El ícono, el splash y el manifest de la app YA INSTALADA son artefactos de build y no pueden
  // variar por comunidad: eso requeriría un export por comunidad.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", colors.SECONDARY);
  }, [colors.SECONDARY]);

  return <View style={[{ flex: 1 }, themeVars]}>{children}</View>;
}
