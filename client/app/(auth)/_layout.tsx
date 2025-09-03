import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="register"
        options={{ title: "Registrarse", headerShown: false }}
      />
      <Stack.Screen
        name="login"
        options={{ title: "Iniciar sesión", headerShown: false }}
      />
    </Stack>
  );
}
