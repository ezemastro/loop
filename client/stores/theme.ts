import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import { DEFAULT_COLORS, type ThemeColorKey, type ThemeColors } from "@/config";
import { isValidHex } from "@/services/color";

interface ThemeStore {
  /** Comunidad del usuario logueado. Sale de `user.community`. */
  community: Community | null;
  /** Comunidad tentativa mientras no hay sesión, resuelta desde el dominio del mail tipeado. */
  previewCommunity: Community | null;
  setCommunity: (community: Community | null) => void;
  setPreview: (community: Community | null) => void;
  clear: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      community: null,
      previewCommunity: null,
      // Al conocer la comunidad real el preview deja de tener sentido y además estorba: `useActiveTheme`
      // le da prioridad, así que uno viejo pintaría al usuario con los colores de otra comunidad.
      setCommunity: (community) => set({ community, previewCommunity: null }),
      setPreview: (previewCommunity) => set({ previewCommunity }),
      clear: () => set({ community: null, previewCommunity: null }),
    }),
    {
      name: "theme-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos la comunidad de la sesión: es lo que evita el flash de colores por defecto
      // al abrir la app. El preview es estado efímero del formulario de registro y persistirlo
      // dejaría al usuario pintado con una comunidad que nunca llegó a ser suya.
      partialize: (state) => ({ community: state.community }),
    },
  ),
);

/** Las claves de `CommunityThemeColors` (camelCase) contra las de `DEFAULT_COLORS` (MAYÚSCULA). */
const COLOR_KEY_MAP: Record<ThemeColorKey, keyof CommunityThemeColors> = {
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary",
  MAIN_TEXT: "mainText",
  SECONDARY_TEXT: "secondaryText",
  CREDITS: "credits",
  CREDITS_LIGHT: "creditsLight",
  STROKE: "stroke",
  BACKGROUND: "background",
  ALERT: "alert",
};

/**
 * Arma la paleta activa a partir de una comunidad. El fallback es por clave y no por paleta
 * entera: una comunidad a la que le falte un color solo hereda ese, no pierde el resto.
 */
export const resolveThemeColors = (community: Community | null): ThemeColors => {
  const colors = community?.theme?.colors;
  const entries = (Object.keys(COLOR_KEY_MAP) as ThemeColorKey[]).map((key) => {
    const value = colors?.[COLOR_KEY_MAP[key]];
    return [key, isValidHex(value) ? value : DEFAULT_COLORS[key]] as const;
  });
  return Object.fromEntries(entries) as ThemeColors;
};

/**
 * Paleta que la app tiene que usar ahora mismo, con las claves en MAYÚSCULA de `DEFAULT_COLORS`.
 * El preview gana porque solo existe cuando no hay sesión.
 */
export const useActiveTheme = (): ThemeColors => {
  const community = useThemeStore((state) => state.community);
  const previewCommunity = useThemeStore((state) => state.previewCommunity);
  // Memoizado porque `resolveThemeColors` devuelve un objeto nuevo y abajo alimenta `vars()`,
  // que dispara un re-render de todo el árbol si cambia de identidad.
  return useMemo(
    () => resolveThemeColors(previewCommunity ?? community),
    [previewCommunity, community],
  );
};
