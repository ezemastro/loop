import { AddUserIcon, UserIcon } from "@/components/Icons";
import { COLORS } from "@/config";
import { useHideOnKeyboard } from "@/hooks/useHideOnKeyboard";
import { Tabs } from "expo-router";

export default function AuthLayout() {
  // Ocultar tab bar al mostrar el teclado
  const { visible } = useHideOnKeyboard();

  return (
    <Tabs
      screenOptions={{
        tabBarHideOnKeyboard: false,
        tabBarInactiveTintColor: COLORS.SECONDARY_TEXT,
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarStyle: {
          display: visible ? "flex" : "none",
        },
      }}
    >
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
    </Tabs>
  );
}
