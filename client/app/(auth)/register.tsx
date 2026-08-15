import Register from "@/components/screens/Register";
import { useLocalSearchParams } from "expo-router";

export default function RegisterPage() {
  // `?invite=TOKEN` habilita registrarse con cualquier correo dentro de la comunidad del admin.
  const { invite } = useLocalSearchParams<{ invite?: string }>();

  return <Register invite={invite} />;
}
