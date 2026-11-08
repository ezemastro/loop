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
      <View className="flex-row items-center gap-3 rounded-lg border border-stroke p-3">
        {community.media?.url ? (
          <Image
            source={{ uri: getUrl(community.media.url) }}
            style={{ width: 36, height: 36 }}
            resizeMode="contain"
          />
        ) : null}
        <View className="flex-1">
          <Text className="text-xs text-secondary-text">Detectamos</Text>
          <Text className="text-base font-semibold" style={{ color: colors.ACCENT }}>
            {community.name}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text className="flex-shrink text-sm text-secondary-text">
          {isNotFound
            ? "No reconocemos ese dominio de correo. "
            : "Usá el correo institucional que te dio tu colegio. "}
          <Text
            accessibilityRole="link"
            onPress={() => setIsModalVisible(true)}
            className="text-accent underline"
          >
            No tengo mail institucional
          </Text>
        </Text>
        {isFetching ? <ActivityIndicator size="small" /> : null}
      </View>
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
