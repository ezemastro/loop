import { Tabs } from "expo-router";

export default function AuthLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="register"
        options={{ title: "Registrarse", headerShown: false }}
      />
      <Tabs.Screen
        name="login"
        options={{ title: "Iniciar sesión", headerShown: false }}
      />
    </Tabs>
  );
}
