import { AddUserIcon, UserIcon } from "@/components/Icons";
import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export default function AuthLayout() {
  // Ocultar tab bar al mostrar el teclado
  const { visible } = useHideOnKeyboard();
  const colors = useThemeColors();
  // From `md` up on web the login/register screens link to each other in text; a bottom tab bar
  // on a desktop window only looks odd. Mobile keeps it.
  const breakpoint = useBreakpoint();
  const isWideWeb = Platform.OS === "web" && breakpoint !== "base";

  return (
    <Tabs
      screenOptions={{
        tabBarHideOnKeyboard: false,
        tabBarInactiveTintColor: colors.SECONDARY_TEXT,
        tabBarActiveTintColor: colors.ACCENT,
        tabBarStyle: {
          display: visible && !isWideWeb ? "flex" : "none",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
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
