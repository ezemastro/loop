import { Text, TextInput, View, FlatList } from "react-native";
import { MainView } from "../bases/MainView";
import SchoolSelector from "../selectors/SchoolSelector";
import CustomButton from "../bases/CustomButton";
import type { ReactNode } from "react";
import Error from "../Error";
import { ERROR_NAMES } from "@/services/errors";
import { useRegisterForm } from "@/hooks/useRegisterForm";
import ButtonText from "../bases/ButtonText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvoidingKeyboard from "../AvoidingKeyboard";

const TextLabel = ({ children }: { children: string }) => (
  <Text className="color-main-text text-xl">{children}</Text>
);

type Field = {
  key: string;
  label: string;
  error: string | null;
  render: () => ReactNode;
};

export default function Register() {
  const insets = useSafeAreaInsets();
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
          onChangeText={(text) =>
            setFormData({ ...formData, confirmPassword: text })
          }
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
          multiple={true}
          value={formData.schools}
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
          style={{
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
          contentContainerClassName="gap-1 px-4 pb-6"
          contentContainerStyle={{
            paddingTop: insets.top + 25,
          }}
          ListHeaderComponent={
            <Text className="text-3xl py-3 text-center font-bold color-main-text">
              Registrarse
            </Text>
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
                <ButtonText>Registrarse</ButtonText>
              </CustomButton>
            </>
          }
        />
      </AvoidingKeyboard>
    </MainView>
  );
}
