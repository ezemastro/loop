import { Modal, ScrollView, Share, Text, View } from "react-native";
import ButtonText from "./ButtonText";
import CustomButton from "./CustomButton";

/**
 * Manual-copy fallback sheet shown when the mail composer could not be opened. Extracted from
 * `ReportButton` so it can be shared with the settings screen's contact entries instead of being
 * copied a third time (see design.md D5).
 *
 * Both action buttons pass `w-auto max-w-none` — `CustomButton` defaults to `w-full`, and inside
 * this `flex-row` that default would make one button eat the whole row, collapsing its sibling to
 * a sliver.
 */
export default function MailFallbackSheet({
  text,
  onClose,
}: {
  /** Full "Para / Asunto / cuerpo" text to recover. Empty string means the sheet is hidden. */
  text: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={!!text} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-4 gap-3 max-h-[70%]">
          <Text className="text-main-text text-xl font-semibold">Copiar mensaje manualmente</Text>
          <Text className="text-secondary-text">
            Mantené presionado el texto para seleccionarlo y copiarlo.
          </Text>
          <ScrollView className="border border-stroke rounded-xl p-3 min-h-36 max-h-72">
            <Text selectable className="text-main-text">
              {text}
            </Text>
          </ScrollView>
          <View className="flex-row gap-2">
            <CustomButton
              className="w-auto max-w-none flex-1"
              onPress={async () => {
                await Share.share({ message: text });
              }}
            >
              <ButtonText className="text-base">Compartir</ButtonText>
            </CustomButton>
            <CustomButton className="w-auto max-w-none flex-1 bg-main-text" onPress={onClose}>
              <ButtonText className="text-base">Cerrar</ButtonText>
            </CustomButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}
