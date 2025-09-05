import { Text, TextInput, View, FlatList } from "react-native";
import { MainView } from "../bases/MainView";
import SchoolSelector from "../SchoolSelector";
import RoleSelector from "../RoleSelector";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { ERROR_NAMES } from "@/services/errors";
import { useRegisterForm } from "@/hooks/useRegisterForm";

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

export default function Register() {
  const {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isRegisterError,
    registerError,
  } = useRegisterForm();
  const fields: Field[] = [
    {
      key: "firstName",
      label: "Nombre:",
      error: errors.firstName,
      errorMessage: "Introduce tu nombre",
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
      errorMessage: "Introduce tu apellido",
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
    {
      key: "confirmPassword",
      label: "Confirmar contraseña:",
      error: errors.confirmPassword,
      errorMessage: "Confirma tu contraseña",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Repita su contraseña"
          secureTextEntry
          value={formData.confirmPassword}
          onChangeText={(text) =>
            setFormData({ ...formData, confirmPassword: text })
          }
          autoCapitalize="none"
        />
      ),
    },
    {
      key: "school",
      label: "Colegio:",
      error: errors.school,
      errorMessage: "Selecciona tu colegio",
      render: () => (
        <SchoolSelector
          value={formData.school}
          onChange={(value) => setFormData({ ...formData, school: value })}
        />
      ),
    },
    {
      key: "role",
      label: "Rol:",
      error: errors.role,
      errorMessage: "Selecciona tu rol",
      render: () => (
        <RoleSelector
          value={formData.role}
          onChange={(value) => setFormData({ ...formData, role: value })}
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
        ListFooterComponent={
          <>
            {registerError?.name === ERROR_NAMES.CONFLICT && (
              <Error>El correo electrónico ya está en uso</Error>
            )}
            {isRegisterError &&
              registerError?.name !== ERROR_NAMES.CONFLICT && (
                <Error>Ocurrió un error al registrarse</Error>
              )}
            <CustomButton
              onPress={handleSubmit}
              className={isRegisterError ? "my-3" : "my-6"}
            >
              Registrarse
            </CustomButton>
          </>
        }
      />
    </MainView>
  );
}
