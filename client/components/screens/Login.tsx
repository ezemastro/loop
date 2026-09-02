import { Text, TextInput, View, FlatList } from "react-native";
import { MainView, pageContentClassName } from "../bases/MainView";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { useLoginForm } from "@/hooks/useLoginForm";
import { useResendVerification } from "@/hooks/useResendVerification";
import Loader from "../Loader";
import ButtonText from "../bases/ButtonText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvoidingKeyboard from "../AvoidingKeyboard";
import { GoogleSignInButton } from "@/components/buttons/GoogleSignInButton";
import AllowedDomainsNotice from "@/components/AllowedDomainsNotice";
import { GOOGLE_OAUTH_READY, NODE_ENV } from "@/config";
import { useToast } from "@/components/ToastProvider";

const TextLabel = ({ children }: { children: string }) => (
  <Text className="color-main-text text-xl">{children}</Text>
);

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
  const contentContainerClassName = pageContentClassName(
    "narrow",
    "gap-2 p-4 pt-6 pb-16 flex-1 justify-center",
  );

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
      label: "Correo electrónico:",
      error: errors.email,
      errorMessage: "Introduce tu correo electrónico",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su correo electrónico"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          autoCapitalize="none"
        />
      ),
    },
    {
      key: "password",
      label: "Contraseña:",
      error: errors.password,
      errorMessage: "Introduce una contraseña",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su contraseña"
          secureTextEntry
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          autoCapitalize="none"
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
            <View className="py-6">
              <Text className="text-3xl p-3 text-center font-bold color-main-text">
                Iniciar sesión
              </Text>
              <Text className="color-main-text/80 text-center mb-4">
                Introduce tus datos o inicia sesión con Google
              </Text>
              <AllowedDomainsNotice />
            </View>
          }
          renderItem={({ item }) => (
            <View className="gap-1">
              <TextLabel>{item.label}</TextLabel>
              <View>
                {item.render()}
                <Error textClassName="text-alert">{item.error ? item.errorMessage : null}</Error>
              </View>
            </View>
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
                  className="mt-1"
                  disabled={resendVerification.isPending}
                >
                  <ButtonText>
                    {resendVerification.isPending ? "Enviando…" : "Reenviar email de verificación"}
                  </ButtonText>
                </CustomButton>
              )}
              {isLoginLoading && <Loader />}
              <CustomButton onPress={handleSubmit}>
                <ButtonText>Iniciar sesión</ButtonText>
              </CustomButton>
              <View className="w-full h-0.5 bg-secondary-text/30 my-6" />
              {GOOGLE_OAUTH_READY || NODE_ENV !== "production" ? (
                <View>
                  <GoogleSignInButton onError={handleGoogleError} />
                </View>
              ) : null}
            </>
          }
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
