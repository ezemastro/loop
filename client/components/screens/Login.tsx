import { Text, View, FlatList } from "react-native";
import { Link } from "expo-router";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import { authContentClassName } from "./authLayout";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { useLoginForm } from "@/hooks/useLoginForm";
import { useResendVerification } from "@/hooks/useResendVerification";
import Loader from "../Loader";
import ButtonText from "../bases/ButtonText";
import { Field, PasswordField, TextField } from "../bases/Field";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvoidingKeyboard from "../AvoidingKeyboard";
import {
  GoogleSignInButton,
  isGoogleSignInAvailable,
} from "@/components/buttons/GoogleSignInButton";
import AllowedDomainsNotice from "@/components/AllowedDomainsNotice";
import { useToast } from "@/components/ToastProvider";

type Field = {
  key: string;
  label: string;
  error: boolean;
  errorMessage: string;
  render: () => ReactNode;
};

export default function Login() {
  const insets = useSafeAreaInsets();
  const {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isLoginError,
    loginErrorMessage,
    loginErrorCode,
    isLoginLoading,
  } = useLoginForm();
  const { showToast } = useToast();
  const resendVerification = useResendVerification();
  const contentContainerClassName = authContentClassName("pb-16 pt-6 md:pb-8 md:pt-8");
  const hasGoogle = isGoogleSignInAvailable();

  const handleGoogleError = (error: string) => {
    showToast(error, "error");
  };

  // Si el correo existe pero no verificó, además del mensaje se ofrece reenviar el mail.
  const isUnverifiedEmail = isLoginError && loginErrorCode === "EMAIL_NOT_VERIFIED";

  const handleResend = () => {
    resendVerification.mutate(
      { email: formData.email.trim() },
      {
        onSuccess: (data) => showToast(data?.message || "Revisá tu email.", "success"),
        onError: () => showToast("No se pudo enviar el email. Probá de nuevo.", "error"),
      },
    );
  };

  const fields: Field[] = [
    {
      key: "email",
      label: "Correo electrónico",
      error: errors.email,
      errorMessage: "Ingresá tu correo electrónico",
      render: () => (
        <TextField
          invalid={errors.email}
          placeholder="Tu correo electrónico"
          keyboardType="email-address"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          autoCapitalize="none"
        />
      ),
    },
    {
      key: "password",
      label: "Contraseña",
      error: errors.password,
      errorMessage: "Ingresá tu contraseña",
      render: () => (
        <PasswordField
          invalid={errors.password}
          placeholder="Tu contraseña"
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
        />
      ),
    },
  ];

  return (
    <MainView>
      <AvoidingKeyboard>
        <FlatList
          data={fields}
          keyExtractor={(item) => item.key}
          className="flex-1"
          style={{
            paddingTop: insets.top,
          }}
          contentContainerClassName={contentContainerClassName}
          ListHeaderComponent={
            <View className="gap-2 pb-2">
              <TextTitle>Iniciar sesión</TextTitle>
              <Text className="text-base text-secondary-text">
                {hasGoogle ? "Ingresá tus datos o iniciá sesión con Google" : "Ingresá tus datos"}
              </Text>
              <AllowedDomainsNotice />
            </View>
          }
          renderItem={({ item }) => (
            <Field label={item.label} error={item.error ? item.errorMessage : null}>
              {item.render()}
            </Field>
          )}
          ListFooterComponent={
            <>
              {isLoginError && !isLoginLoading && !!loginErrorMessage && (
                <Error textClassName="text-alert" className="my-2">
                  {loginErrorMessage}
                </Error>
              )}
              {isUnverifiedEmail && (
                <CustomButton
                  onPress={handleResend}
                  variant="secondary"
                  className="mt-1 max-w-none"
                  loading={resendVerification.isPending}
                >
                  <ButtonText>{"Reenviar email de verificación"}</ButtonText>
                </CustomButton>
              )}
              {isLoginLoading && <Loader />}
              <CustomButton onPress={handleSubmit} className="max-w-none">
                <ButtonText>Iniciar sesión</ButtonText>
              </CustomButton>
              <Link href="/(auth)/forgot-password" className="py-1 text-left text-base text-accent">
                ¿Olvidaste tu contraseña?
              </Link>
              {hasGoogle ? (
                <>
                  <View className="my-2 h-px w-full bg-stroke" />
                  <GoogleSignInButton onError={handleGoogleError} />
                </>
              ) : null}
              <Text className="pt-2 text-left text-base text-secondary-text">
                ¿No tenés cuenta?{" "}
                <Link href="/(auth)/register" className="font-semibold text-accent">
                  Registrate
                </Link>
              </Text>
            </>
          }
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
