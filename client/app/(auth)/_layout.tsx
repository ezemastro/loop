import { AddUserIcon, UserIcon } from "@/components/Icons";
import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export default function AuthLayout() {
  // Ocultar tab bar al mostrar el teclado
  const { visible } = useHideOnKeyboard();
  const colors = useThemeColors();
  // From `md` up on web the login/register screens link to each other in text; a bottom tab bar
  // on a desktop window only looks odd. Mobile keeps it.
  const breakpoint = useBreakpoint();
  // These routes are prerendered at the base breakpoint: deciding from the window width during the
  // first client render would differ from the HTML (React hydration error #418).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const isWideWeb = hydrated && Platform.OS === "web" && breakpoint !== "base";

  return (
    <Tabs
      // `tabBarStyle.display` alone does not hide the bar after hydrating at the base breakpoint.
      tabBar={isWideWeb ? () => null : undefined}
      screenOptions={{
        tabBarHideOnKeyboard: false,
        tabBarInactiveTintColor: colors.SECONDARY_TEXT,
        tabBarActiveTintColor: colors.ACCENT,
        tabBarStyle: {
          display: visible ? "flex" : "none",
        },
      }}
    >
      <Tabs.Screen
        name="ingresar"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="login"
        options={{
          title: "Iniciar sesión",
          headerShown: false,
          tabBarIcon: ({ color }) => <UserIcon style={{ color }} />,
        }}
      />
      <Tabs.Screen
        name="register"
        options={{
          title: "Registrarse",
          headerShown: false,
          tabBarIcon: ({ color }) => <AddUserIcon style={{ color }} />,
        }}
      />
      <Tabs.Screen
        name="schoolSelection"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="forgot-password"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reset-password"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
