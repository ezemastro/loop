import { View, Text, BackHandler } from "react-native";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { MainView } from "../bases/MainView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionStore } from "@/stores/session";

export default function TermsPage() {
  const insets = useSafeAreaInsets();
  const setHasAcceptedTerms = useSessionStore(
    (state) => state.setHasAcceptedTerms,
  );
  const handleAccept = () => {
    setHasAcceptedTerms(true);
  };

  const handleReject = () => {
    setHasAcceptedTerms(false);
    // Cerrar la aplicación
    BackHandler.exitApp();
  };

  return (
    <View
      className="flex-1"
      style={{
        paddingBottom: insets.bottom,
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <MainView className="p-4">
        <View className="flex-grow">
          <Text className="text-3xl text-main-text text-center">
            Terms and Conditions
          </Text>
          <Text className="text-main-text mt-4">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </Text>
        </View>
        <View className="flex-row gap-2">
          <CustomButton onPress={handleReject} className="bg-alert">
            <ButtonText>Rechazar</ButtonText>
          </CustomButton>
          <CustomButton onPress={handleAccept} className="flex-grow">
            <ButtonText>Aceptar</ButtonText>
          </CustomButton>
        </View>
      </MainView>
    </View>
  );
}
