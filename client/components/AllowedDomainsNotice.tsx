import { useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator } from "react-native";
import { useDebounce } from "use-debounce";
import * as Clipboard from "expo-clipboard";
import CustomModal from "./bases/CustomModal";
import ModalHeader, { modalSurfaceClassName } from "./bases/ModalHeader";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";
import { useResolveCommunity } from "@/hooks/useResolveCommunity";
import { resolveThemeColors } from "@/stores/theme";
import { getUrl } from "@/services/getUrl";
import { CONTACT_EMAIL } from "@/config";
import { openMailComposer } from "@/services/emailComposer";
import { showAlert } from "@/services/showAlert";

/** Mismo debounce que el del formulario para que ambos compartan la entrada de caché de react-query. */
const RESOLVE_DEBOUNCE_MS = 400;

const hasResolvableDomain = (email: string) => {
  const domain = email.split("@")[1];
  return Boolean(domain && domain.includes(".") && !domain.endsWith("."));
};

/**
 * Ya no lista dominios: la lista vive en la base y solo el servidor la conoce. Lo que hace ahora es
 * decirle al usuario qué comunidad detectamos a partir de su correo, o que no detectamos ninguna.
 */
export default function AllowedDomainsNotice({ email }: { email?: string }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleContactPress = async () => {
    const opened = await openMailComposer(CONTACT_EMAIL);
    if (opened) return;

    showAlert("No se pudo abrir la app de correo", `Escribinos a ${CONTACT_EMAIL}`, [
      {
        text: "Copiar mail",
        onPress: () => {
          void Clipboard.setStringAsync(CONTACT_EMAIL);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        },
      },
      { text: "Cerrar", style: "cancel" },
    ]);
  };

  const [debouncedEmail] = useDebounce(email?.trim() ?? "", RESOLVE_DEBOUNCE_MS);
  const emailToResolve = hasResolvableDomain(debouncedEmail) ? debouncedEmail : undefined;
  const { data, isFetching, isSuccess } = useResolveCommunity({ email: emailToResolve });

  const community = emailToResolve ? (data ?? null) : null;
  const isNotFound = Boolean(emailToResolve) && isSuccess && !data;

  if (community) {
    // Los colores salen de la comunidad y no de las clases de Tailwind para que el cartel sea
    // correcto aunque el tema global todavía no se haya actualizado.
    const colors = resolveThemeColors(community);
    return (
      <View
        className="rounded-lg p-3 mx-4 gap-2 flex-row items-center border"
        style={{ backgroundColor: `${colors.ACCENT}1A`, borderColor: `${colors.ACCENT}4D` }}
      >
        {community.media?.url ? (
          <Image
            source={{ uri: getUrl(community.media.url) }}
            style={{ width: 44, height: 44 }}
            resizeMode="contain"
          />
        ) : null}
        <View className="flex-1">
          <Text className="text-sm" style={{ color: colors.SECONDARY_TEXT }}>
            Detectamos
          </Text>
          <Text className="text-lg font-bold" style={{ color: colors.ACCENT }}>
            {community.name}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-accent/10 border border-accent/30 rounded-lg p-3 mx-4 gap-2">
      <View className="flex-row items-center justify-center gap-2">
        <Text className="color-main-text text-center text-base font-semibold">
          {isNotFound
            ? "No reconocemos ese dominio de correo."
            : "Usá el correo institucional que te dio tu colegio."}
        </Text>
        {isFetching ? <ActivityIndicator size="small" /> : null}
      </View>
      <Pressable onPress={() => setIsModalVisible(true)}>
        <Text className="text-accent text-center text-sm underline">
          No tengo mail institucional
        </Text>
      </Pressable>
      <CustomModal isVisible={isModalVisible} handleClose={() => setIsModalVisible(false)}>
        <View className={modalSurfaceClassName()}>
          <ModalHeader
            title="¿No tenés mail institucional?"
            onClose={() => setIsModalVisible(false)}
          />
          <Text className="text-main-text text-base">
            Si no tenés un mail institucional, escribinos a{" "}
            <Pressable onPress={handleContactPress}>
              <Text className="text-accent underline">{CONTACT_EMAIL}</Text>
            </Pressable>{" "}
            y te enviaremos un enlace para que puedas registrarte con tu mail personal.
          </Text>
          {isCopied ? <Text className="text-secondary-text text-sm">Mail copiado.</Text> : null}
          <CustomButton onPress={() => setIsModalVisible(false)}>
            <ButtonText>Entendido</ButtonText>
          </CustomButton>
        </View>
      </CustomModal>
    </View>
  );
}
