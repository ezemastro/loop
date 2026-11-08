import { Text, View, FlatList, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import { authContentClassName } from "./authLayout";
import SchoolSelector from "../selectors/SchoolSelector";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { useRegisterForm } from "@/hooks/useRegisterForm";
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
  error: string | null;
  render: () => ReactNode;
};

export default function Register({ invite }: { invite?: string }) {
  const insets = useSafeAreaInsets();
  const {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isRegisterError,
    displayError,
    community,
    invitation,
    isResolvingCommunity,
    isCommunityNotFound,
  } = useRegisterForm(invite);
  const { showToast } = useToast();
  const contentContainerClassName = authContentClassName("justify-start gap-1 pb-6 md:pb-8");
  const hasGoogle = isGoogleSignInAvailable();

  const handleGoogleError = (error: string) => {
    showToast(error, "error");
  };

  // Sin comunidad no hay colegios que listar; el motivo cambia según en qué punto esté la búsqueda.
  const schoolsDisabledText = isResolvingCommunity
    ? "Buscando tu comunidad…"
    : isCommunityNotFound
      ? "No reconocemos ese dominio de correo"
      : "Escribí tu correo institucional para ver los colegios disponibles";

  const fields: Field[] = [
    {
      key: "firstName",
      label: "Nombre",
      error: errors.firstName,
      render: () => (
        <TextField
          invalid={!!errors.firstName}
          placeholder="Tu nombre"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        />
      ),
    },
    {
      key: "lastName",
      label: "Apellido",
      error: errors.lastName,
      render: () => (
        <TextField
          invalid={!!errors.lastName}
          placeholder="Tu apellido"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />
      ),
    },
    {
      key: "email",
      label: "Correo electrónico",
      error: errors.email,
      render: () => (
        <TextField
          invalid={!!errors.email}
          placeholder="Tu correo electrónico"
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
      render: () => (
        <PasswordField
          invalid={!!errors.password}
          placeholder="Tu contraseña"
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
        />
      ),
    },
    {
      key: "confirmPassword",
      label: "Confirmar contraseña",
      error: errors.confirmPassword,
      render: () => (
        <PasswordField
          invalid={!!errors.confirmPassword}
          placeholder="Repetí tu contraseña"
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
        />
      ),
    },
    {
      key: "schools",
      label: "Colegios",
      error: errors.schools,
      render: () => (
        <SchoolSelector
          multiple
          // `null` mantiene el selector deshabilitado hasta saber a qué comunidad pertenece.
          communityId={community?.id ?? null}
          disabledText={schoolsDisabledText}
          value={formData.schools ?? []}
          onChange={(value) => setFormData({ ...formData, schools: value })}
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
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
          contentContainerClassName={contentContainerClassName}
          contentContainerStyle={{
            paddingTop: insets.top + 25,
          }}
          ListHeaderComponent={
            <View>
              <TextTitle className="pb-3">Registrarse</TextTitle>
              {invitation.isLoading ? (
                <View className="py-3">
                  <ActivityIndicator size="small" />
                </View>
              ) : invitation.community ? (
                <View className="gap-0.5 rounded-lg border border-stroke p-3">
                  <Text className="text-left text-sm text-secondary-text">
                    Invitación válida: podés registrarte con cualquier correo
                  </Text>
                  <Text className="text-left text-base font-semibold text-main-text">
                    Vas a entrar a {invitation.community.name}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Con un token roto seguimos con el registro normal, o sea con restricción de dominio. */}
                  {invitation.isError && invitation.errorMessage ? (
                    <Error textClassName="text-alert" className="mb-2 items-start">
                      {invitation.errorMessage}
                    </Error>
                  ) : null}
                  <AllowedDomainsNotice email={formData.email} />
                </>
              )}
            </View>
          }
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Field label={item.label} error={item.error} className="mb-3">
              {item.render()}
            </Field>
          )}
          ListFooterComponent={
            <>
              {isRegisterError && displayError && (
                <Error textClassName="text-alert" className="my-2">
                  {displayError}
                </Error>
              )}
              <CustomButton
                onPress={handleSubmit}
                className={isRegisterError ? "mt-2 max-w-none" : "mt-6 max-w-none"}
              >
                <ButtonText>Registrarse</ButtonText>
              </CustomButton>
              <Text className="mt-3 text-left text-sm text-secondary-text">
                Al registrarte aceptás nuestros{" "}
                <Link href="/terminos" className="text-accent">
                  términos y condiciones
                </Link>{" "}
                y nuestra{" "}
                <Link href="/privacidad" className="text-accent">
                  política de privacidad
                </Link>
                .
              </Text>
              {hasGoogle ? (
                <View className="mt-6 gap-4 border-t border-stroke pt-6">
                  <GoogleSignInButton
                    onError={handleGoogleError}
                    // Solo se manda si la invitación resultó válida; si no, alta normal por dominio.
                    invitationToken={invitation.community ? invitation.token : undefined}
                  />
                </View>
              ) : null}
              <Text className="pt-6 text-left text-base text-secondary-text">
                ¿Ya tenés cuenta?{" "}
                <Link href="/(auth)/login" className="font-semibold text-accent">
                  Iniciá sesión
                </Link>
              </Text>
            </>
          }
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
