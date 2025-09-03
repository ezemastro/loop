import { Text, TextInput, View, FlatList } from "react-native";
import { MainView } from "../bases/MainView";
import SchoolSelector from "../SchoolSelector";
import RoleSelector from "../RoleSelector";
import CustomButton from "../bases/CustomButton";
import { ReactNode } from "react";

const TextLabel = ({ children }: { children: string }) => (
  <Text className="color-main-text text-xl">{children}</Text>
);

type Field = {
  key: string;
  label: string;
  render: () => ReactNode;
};

export default function Register() {
  const fields: Field[] = [
    {
      key: "firstName",
      label: "Nombre:",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su nombre"
        />
      ),
    },
    {
      key: "lastName",
      label: "Apellido:",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su apellido"
        />
      ),
    },
    {
      key: "email",
      label: "Correo electrónico:",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su correo electrónico"
        />
      ),
    },
    {
      key: "password",
      label: "Contraseña:",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Ingrese su contraseña"
          secureTextEntry
        />
      ),
    },
    {
      key: "confirmPassword",
      label: "Confirmar contraseña:",
      render: () => (
        <TextInput
          className="border border-stroke rounded p-2 bg-white"
          placeholder="Repita su contraseña"
          secureTextEntry
        />
      ),
    },
    {
      key: "school",
      label: "Colegio:",
      render: () => <SchoolSelector />,
    },
    {
      key: "role",
      label: "Rol:",
      render: () => <RoleSelector />,
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
          </View>
        )}
        ListFooterComponent={
          <CustomButton onPress={() => {}} className="my-6">
            Registrarse
          </CustomButton>
        }
      />
    </MainView>
  );
}
