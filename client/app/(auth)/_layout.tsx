import { AddUserIcon, UserIcon } from "@/components/Icons";
import { COLORS } from "@/config";
import { Tabs } from "expo-router";

export default function AuthLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: COLORS.SECONDARY_TEXT,
        tabBarActiveTintColor: COLORS.PRIMARY,
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
