import { AddUserIcon, UserIcon } from "@/components/Icons";
import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Tabs } from "expo-router";

export default function AuthLayout() {
  // Ocultar tab bar al mostrar el teclado
  const { visible } = useHideOnKeyboard();
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarHideOnKeyboard: false,
        tabBarInactiveTintColor: colors.SECONDARY_TEXT,
        tabBarActiveTintColor: colors.PRIMARY,
        tabBarStyle: {
          display: visible ? "flex" : "none",
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
    </Tabs>
  );
}
