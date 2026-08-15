import { useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator } from "react-native";
import { useDebounce } from "use-debounce";
import CustomModal from "./bases/CustomModal";
import CloseModalButton from "./CloseModalButton";
import TextTitle from "./bases/TextTitle";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";
import { useResolveCommunity } from "@/hooks/useResolveCommunity";
import { resolveThemeColors } from "@/stores/theme";
import { getUrl } from "@/services/getUrl";

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
        style={{ backgroundColor: `${colors.PRIMARY}1A`, borderColor: `${colors.PRIMARY}4D` }}
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
          <Text className="text-lg font-bold" style={{ color: colors.PRIMARY }}>
            {community.name}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-primary/10 border border-primary/30 rounded-lg p-3 mx-4 gap-2">
      <View className="flex-row items-center justify-center gap-2">
        <Text className="color-main-text text-center text-base font-semibold">
          {isNotFound
            ? "No reconocemos ese dominio de correo."
            : "Usá el correo institucional que te dio tu colegio."}
        </Text>
        {isFetching ? <ActivityIndicator size="small" /> : null}
      </View>
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
            Si no tenés un mail institucional, te pedimos que te contactes con la sede a la que
            perteneces para que te comenten la situacion sobre el mail de tu hijo/a.
          </Text>
          <CustomButton onPress={() => setIsModalVisible(false)}>
            <ButtonText>Entendido</ButtonText>
          </CustomButton>
        </View>
      </CustomModal>
    </View>
  );
}
