import { useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { useRouter, usePathname } from "expo-router";
import { MainView, pageContentClassName } from "../bases/MainView";
import BackButton from "../BackButton";
import CustomModal from "../bases/CustomModal";
import CloseModalButton from "../CloseModalButton";
import TextTitle from "../bases/TextTitle";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import Error from "../Error";
import MailFallbackSheet from "../bases/MailFallbackSheet";
import SettingsRow from "../settings/SettingsRow";
import { SETTINGS_GROUPS, type SettingsItem } from "../settings/settingsItems";
import { useSessionStore } from "@/stores/session";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
import { useMailComposer } from "@/hooks/useMailComposer";
import { buildSupportMail, type SupportMailTemplate } from "@/services/supportMail";
import { canConfirmAccountDeletion } from "@/services/accountDeletion";
import { CONTACT_EMAIL } from "@/config";

export default function Settings() {
  const user = useSessionStore((state) => state.user);
  const logout = useSessionStore((state) => state.logout);
  const pathname = usePathname();
  const router = useRouter();
  const contentClassName = pageContentClassName("narrow", "p-4 gap-6");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState("");
  const { mutate: deleteAccount, isPending: isDeleting, error: deleteError } = useDeleteAccount();
  const { manualCopyText, sendMail, closeFallback } = useMailComposer();

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeleteEmailConfirm("");
  };

  const handleMail = async (template: SupportMailTemplate) => {
    const { subject, body } = buildSupportMail(template, {
      version: Constants.expoConfig?.version ?? "desconocida",
      platform: Platform.OS,
      route: pathname,
    });
    await sendMail(CONTACT_EMAIL, subject, body);
  };

  const handlePress = (item: SettingsItem) => {
    switch (item.action.kind) {
      case "logout":
        logout();
        return;
      case "deleteAccount":
        setIsDeleteModalOpen(true);
        return;
      case "mail":
        handleMail(item.action.template);
        return;
      case "link":
        router.push(item.action.href);
        return;
    }
  };

  if (!user) return null;

  return (
    <MainView>
      <ScrollView contentContainerClassName={contentClassName}>
        <View className="flex-row items-center">
          <BackButton />
        </View>
        <Text className="text-2xl text-main-text">Ajustes</Text>
        {SETTINGS_GROUPS.map((group) => (
          <View key={group.key} className="gap-2">
            <Text className="text-xl text-main-text">{group.title}</Text>
            <View className="gap-2">
              {group.items.map((item) => (
                <SettingsRow
                  key={item.key}
                  label={item.label}
                  description={item.description}
                  Icon={item.Icon}
                  variant={item.variant}
                  onPress={() => handlePress(item)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <CustomModal isVisible={isDeleteModalOpen} handleClose={closeDeleteModal}>
        {(modalMaxHeight) => (
          <View
            className="overflow-hidden bg-background rounded-lg w-full"
            style={{ maxHeight: modalMaxHeight }}
          >
            <ScrollView className="p-6" contentContainerClassName="gap-4">
              <CloseModalButton onClose={closeDeleteModal} />
              <TextTitle>Eliminar cuenta</TextTitle>
              <Text className="text-main-text text-base">
                Esta acción es permanente e irreversible. Se eliminarán todos tus datos, incluyendo
                publicaciones, mensajes, notificaciones y transacciones.
              </Text>
              <View className="gap-2">
                <Text className="text-main-text text-lg">Escribí tu email para confirmar:</Text>
                <TextInput
                  className="bg-white rounded border border-stroke px-4 py-3 text-main-text"
                  placeholder={user.email}
                  value={deleteEmailConfirm}
                  onChangeText={setDeleteEmailConfirm}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {deleteError && (
                <Error>
                  {(deleteError as { message?: string })?.message || "Error al eliminar la cuenta"}
                </Error>
              )}
              <CustomButton
                className="bg-alert"
                disabled={!canConfirmAccountDeletion(deleteEmailConfirm, user.email, isDeleting)}
                onPress={() => deleteAccount()}
              >
                <ButtonText>{isDeleting ? "Eliminando..." : "Eliminar cuenta"}</ButtonText>
              </CustomButton>
            </ScrollView>
          </View>
        )}
      </CustomModal>

      <MailFallbackSheet text={manualCopyText} onClose={closeFallback} />
    </MainView>
  );
}
