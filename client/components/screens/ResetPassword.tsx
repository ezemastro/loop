import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MainView, pageContentClassName } from "../bases/MainView";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import TextTitle from "../bases/TextTitle";
import Error from "../Error";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResetPassword } from "@/hooks/useResetPassword";
import { validateResetPasswordForm } from "@/services/validations";

/**
 * SEC-11: the screen the emailed reset link opens (`APP_BASE_URL/reset-password?token=...`, see
 * `server/api/src/services/email.ts`). A missing/invalid token, or a used/expired one, surfaces
 * as a plain error from the API — the token itself is opaque to this screen, it only forwards it.
 */
export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { mutate, isPending, isSuccess, error } = useResetPassword();
  const contentClassName = pageContentClassName("narrow", "gap-4 p-4 flex-1 justify-center");

  const handleSubmit = () => {
    const result = validateResetPasswordForm({ newPassword, confirmPassword });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setFieldError(null);
    mutate({ token: token ?? "", newPassword });
  };

  if (!token) {
    return (
      <MainView>
        <View className={contentClassName} style={{ paddingTop: insets.top }}>
          <TextTitle className="mb-2 text-3xl">Enlace inválido</TextTitle>
          <Text className="text-main-text text-lg leading-6">
            Este enlace de recuperación de contraseña no es válido. Pedí uno nuevo desde la
            pantalla de inicio de sesión.
          </Text>
        </View>
      </MainView>
    );
  }

  return (
    <MainView>
      <View className={contentClassName} style={{ paddingTop: insets.top }}>
        <TextTitle className="mb-2 text-3xl">Elegí tu nueva contraseña</TextTitle>
        {isSuccess ? (
          <>
            <Text className="text-main-text text-lg leading-6">
              Tu contraseña se actualizó correctamente. Ya podés iniciar sesión con la nueva.
            </Text>
            <CustomButton onPress={() => router.replace("/(auth)/login")}>
              <ButtonText>Ir a iniciar sesión</ButtonText>
            </CustomButton>
          </>
        ) : (
          <>
            <TextInput
              className="border border-stroke rounded p-2 bg-white"
              placeholder="Contraseña nueva"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              className="border border-stroke rounded p-2 bg-white"
              placeholder="Confirmá la contraseña nueva"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {fieldError && <Error textClassName="text-alert">{fieldError}</Error>}
            {error && (
              <Error textClassName="text-alert">
                {(error as { message?: string }).message ||
                  "El enlace no es válido o ya expiró. Pedí uno nuevo."}
              </Error>
            )}
            <CustomButton onPress={handleSubmit} disabled={isPending}>
              <ButtonText>{isPending ? "Guardando…" : "Guardar contraseña"}</ButtonText>
            </CustomButton>
          </>
        )}
      </View>
    </MainView>
  );
}
