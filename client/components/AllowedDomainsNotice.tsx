import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { VALID_EMAIL_DOMAINS, INSTITUTIONAL_EMAIL_FORM_URL } from "@/config";
import CustomModal from "./bases/CustomModal";
import CloseModalButton from "./CloseModalButton";
import TextTitle from "./bases/TextTitle";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";

const ALLOWED_DOMAINS_TEXT = VALID_EMAIL_DOMAINS.map((domain) => `@${domain}`).join(", ");

export default function AllowedDomainsNotice() {
  const [isModalVisible, setIsModalVisible] = useState(false);

  return (
    <View className="bg-primary/10 border border-primary/30 rounded-lg p-3 mx-4 gap-2">
      <Text className="color-main-text text-center text-base font-semibold mb-1">
        Solo podrás acceder con correos de estos dominios:
      </Text>
      <Text className="color-main-text text-center text-sm">{ALLOWED_DOMAINS_TEXT}</Text>
      <Pressable onPress={() => setIsModalVisible(true)}>
        <Text className="text-primary text-center text-sm underline">
          No tengo mail institucional
        </Text>
      </Pressable>
      <CustomModal isVisible={isModalVisible} handleClose={() => setIsModalVisible(false)}>
        <View className="bg-background rounded p-6 w-full max-w-md gap-4">
          <CloseModalButton onClose={() => setIsModalVisible(false)} />
          <TextTitle>¿No tenés mail institucional?</TextTitle>
          <Text className="text-main-text text-base">
            Podés usar el mail institucional de tus hijos para registrarte. Si no lo sabés,
            preguntaselo a tus hijos.
          </Text>
          {INSTITUTIONAL_EMAIL_FORM_URL ? (
            <View className="gap-2">
              <Text className="text-main-text text-base">
                También podés consultar el mail de tus hijos completando el siguiente formulario:
              </Text>
              <Pressable
                onPress={() => {
                  if (INSTITUTIONAL_EMAIL_FORM_URL) {
                    Linking.openURL(INSTITUTIONAL_EMAIL_FORM_URL);
                  }
                }}
              >
                <Text className="text-secondary text-base underline">
                  Consultar mail institucional
                </Text>
              </Pressable>
            </View>
          ) : null}
          <CustomButton onPress={() => setIsModalVisible(false)}>
            <ButtonText>Entendido</ButtonText>
          </CustomButton>
        </View>
      </CustomModal>
    </View>
  );
}
