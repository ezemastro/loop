import { Text, TextInput, View, FlatList } from "react-native";
import { MainView } from "../bases/MainView";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { ERROR_NAMES } from "@/services/errors";
import { useLoginForm } from "@/hooks/useLoginForm";

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
  const {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isLoginError,
    loginError,
  } = useLoginForm();
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
        />
      ),
    },
  ];

  return (
    <MainView>
      <FlatList
        data={fields}
        keyExtractor={(item) => item.key}
        className="p-4"
        contentContainerClassName="gap-4 pt-6 pb-16"
        ListHeaderComponent={
          <Text className="text-3xl py-3 text-center font-bold color-main-text">
            Registrarse
          </Text>
        }
        renderItem={({ item }) => (
          <View className="gap-2">
            <TextLabel>{item.label}</TextLabel>
            {item.render()}
            {item.error && <Error>{item.errorMessage}</Error>}
          </View>
        )}
        ListFooterComponentStyle={{ marginTop: "auto" }}
        ListFooterComponent={
          <>
            {loginError?.name === ERROR_NAMES.CONFLICT && (
              <Error>El correo electrónico ya está en uso</Error>
            )}
            {isLoginError && loginError?.name !== ERROR_NAMES.CONFLICT && (
              <Error>Ocurrió un error al iniciar sesión</Error>
            )}
            <CustomButton
              onPress={handleSubmit}
              className={isLoginError ? "my-3" : "my-6"}
            >
              Registrarse
            </CustomButton>
          </>
        }
      />
    </MainView>
  );
}
