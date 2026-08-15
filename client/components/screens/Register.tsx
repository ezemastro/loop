import { Text, TextInput, View, FlatList, ActivityIndicator } from "react-native";
import { MainView } from "../bases/MainView";
import SchoolSelector from "../selectors/SchoolSelector";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { useRegisterForm } from "@/hooks/useRegisterForm";
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
      label: "Nombre:",
      error: errors.firstName,
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su nombre"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        />
      ),
    },
    {
      key: "lastName",
      label: "Apellido:",
      error: errors.lastName,
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su apellido"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />
      ),
    },
    {
      key: "email",
      label: "Correo electrónico:",
      error: errors.email,
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
    {
      key: "confirmPassword",
      label: "Confirmar contraseña:",
      error: errors.confirmPassword,
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Repita su contraseña"
          secureTextEntry
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          autoCapitalize="none"
        />
      ),
    },
    {
      key: "schools",
      label: "Colegios:",
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
          contentContainerClassName="gap-1 px-4 pb-6"
          contentContainerStyle={{
            paddingTop: insets.top + 25,
          }}
          ListHeaderComponent={
            <View>
              <Text className="text-3xl py-3 text-center font-bold color-main-text">
                Registrarse
              </Text>
              {invitation.isLoading ? (
                <View className="mx-4 py-3">
                  <ActivityIndicator size="small" />
                </View>
              ) : invitation.community ? (
                <View className="bg-tertiary/10 border border-tertiary/30 rounded-lg p-3 mx-4 gap-1">
                  <Text className="color-main-text text-center text-base font-semibold">
                    Invitación válida: podés registrarte con cualquier correo
                  </Text>
                  <Text className="text-secondary-text text-center text-sm">
                    Vas a entrar a la comunidad
                  </Text>
                  <Text className="text-tertiary text-center text-lg font-bold">
                    {invitation.community.name}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Con un token roto seguimos con el registro normal, o sea con restricción de dominio. */}
                  {invitation.isError && invitation.errorMessage ? (
                    <Error textClassName="text-alert" className="mx-4 mb-2">
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
            <View className="gap-2">
              <TextLabel>{item.label}</TextLabel>
              <View>
                {item.render()}
                <Error textClassName="text-alert">{item.error}</Error>
              </View>
            </View>
          )}
          ListFooterComponent={
            <>
              {isRegisterError && displayError && (
                <Error textClassName="text-alert" className="my-2">
                  {displayError}
                </Error>
              )}
              <CustomButton onPress={handleSubmit} className={isRegisterError ? "mt-2" : "mt-6"}>
                <ButtonText>Registrarse</ButtonText>
              </CustomButton>
              <View className="w-full h-0.5 bg-secondary-text/30 my-6" />
              {GOOGLE_OAUTH_READY || NODE_ENV !== "production" ? (
                <View>
                  <GoogleSignInButton
                    onError={handleGoogleError}
                    // Solo se manda si la invitación resultó válida; si no, alta normal por dominio.
                    invitationToken={invitation.community ? invitation.token : undefined}
                  />
                </View>
              ) : null}
            </>
          }
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
