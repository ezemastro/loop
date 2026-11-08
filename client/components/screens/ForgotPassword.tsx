import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MainView } from "../bases/MainView";
import { authContentClassName } from "./authLayout";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { TextField } from "../bases/Field";
import TextTitle from "../bases/TextTitle";
import Error from "../Error";
import BackButton from "../BackButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForgotPassword } from "@/hooks/useForgotPassword";
import { isValidEmailFormat } from "@/services/validations";

/**
 * SEC-11: self-service "olvidé mi contraseña", linked from `Login.tsx`. Always shows the same
 * confirmation regardless of whether the account exists (spec `password-reset`, "Unknown address
 * is indistinguishable") — the UI must not imply otherwise.
 */
export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState(false);
  const { mutate, isPending, isSuccess } = useForgotPassword();
  const contentClassName = authContentClassName();

  const handleSubmit = () => {
    if (!isValidEmailFormat(email)) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    mutate({ email: email.trim() });
  };

  return (
    <MainView>
      <View className="flex-row items-center" style={{ paddingTop: insets.top }}>
        <BackButton />
      </View>
      <View className={contentClassName}>
        <TextTitle className="mb-2">Recuperar contraseña</TextTitle>
        {isSuccess ? (
          <>
            <Text className="text-base leading-6 text-main-text">
              Si ese email está registrado, te mandamos un enlace para restablecer tu contraseña.
              Revisá tu bandeja de entrada.
            </Text>
            <CustomButton className="max-w-none" onPress={() => router.replace("/(auth)/login")}>
              <ButtonText>Volver a iniciar sesión</ButtonText>
            </CustomButton>
          </>
        ) : (
          <>
            <Text className="text-base leading-6 text-main-text">
              Ingresá el email de tu cuenta y te mandamos un enlace para elegir una contraseña
              nueva.
            </Text>
            <TextField
              invalid={validationError}
              placeholder="tu-email@colegio.edu.ar"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {validationError && <Error textClassName="text-alert">Ingresá un email válido</Error>}
            <CustomButton className="max-w-none" onPress={handleSubmit} loading={isPending}>
              <ButtonText>Enviar enlace</ButtonText>
            </CustomButton>
          </>
        )}
      </View>
    </MainView>
  );
}
