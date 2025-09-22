import { useSessionStore } from "@/stores/session";
import { Text } from "react-native";
import { MainView } from "../bases/MainView";
import TextTitle from "../bases/TextTitle";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";

export default function MyProfile() {
  const { logout } = useSessionStore();
  return (
    <MainView className="p-4">
      <TextTitle>Perfil</TextTitle>
      <Text className="text-secondary-text text-center">
        Aquí podrás ver y editar la información de tu perfil.
      </Text>
      <CustomButton onPress={logout} className="mt-4">
        <ButtonText>Cerrar sesión</ButtonText>
      </CustomButton>
    </MainView>
  );
}
