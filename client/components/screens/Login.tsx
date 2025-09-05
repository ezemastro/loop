import {
  Text,
  TextInput,
  View,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { MainView } from "../bases/MainView";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { ERROR_NAMES } from "@/services/errors";
import { useLoginForm } from "@/hooks/useLoginForm";
import Loader from "../Loader";

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
    isLoginLoading,
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
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <FlatList
          data={fields}
          keyExtractor={(item) => item.key}
          className="p-4"
          contentContainerClassName="gap-4 pt-6 pb-16 flex-1 justify-center"
          ListHeaderComponent={
            <Text className="text-3xl py-4 text-center font-bold color-main-text">
              Iniciar sesión
            </Text>
          }
          renderItem={({ item }) => (
            <View className="gap-2">
              <TextLabel>{item.label}</TextLabel>
              {item.render()}
              {item.error && <Error>{item.errorMessage}</Error>}
            </View>
          )}
          ListFooterComponent={
            <>
              {!isLoginLoading &&
                loginError?.name === ERROR_NAMES.INVALID_INPUT && (
                  <Error>Correo electrónico o contraseña incorrectos</Error>
                )}
              {isLoginError &&
                !isLoginLoading &&
                loginError?.name === ERROR_NAMES.INTERNAL_SERVER && (
                  <Error>Ocurrió un error al iniciar sesión</Error>
                )}
              {isLoginLoading && <Loader />}
              <CustomButton onPress={handleSubmit} className="mt-6">
                Iniciar sesión
              </CustomButton>
            </>
          }
        />
      </KeyboardAvoidingView>
    </MainView>
  );
}
