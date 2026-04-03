import { REPORT_EMAIL } from "@/config";
import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  Text,
  View,
  type PressableProps,
} from "react-native";
import ButtonText from "./bases/ButtonText";
import CustomButton from "./bases/CustomButton";

type ReportButtonProps = PressableProps & {
  label?: string;
  listing?: Listing;
  user?: PublicUser;
};

export default function ReportButton({
  label = "Denunciar",
  listing,
  user,
  ...props
}: ReportButtonProps) {
  const [manualCopyText, setManualCopyText] = useState("");

  const getReportData = () => {
    if (listing) {
      const listingUrl = `loop://(main)/listing/${listing.id}`;
      const sellerSchools = listing.seller.schools
        .map((school) => school.name)
        .join(", ");

      return {
        subject: `Denuncia de publicación ${listing.id}`,
        body: [
          "Hola equipo de Loop,",
          "",
          "Quiero denunciar la siguiente publicación:",
          `- Listing ID: ${listing.id}`,
          `- Título: ${listing.title}`,
          `- Vendedor ID: ${listing.seller.id}`,
          `- Estado publicación: ${listing.listingStatus}`,
          `- Estado producto: ${listing.productStatus}`,
          `- Precio: ${listing.price}`,
          `- Categoría: ${listing.category.name}`,
          `- Colegios: ${sellerSchools || "Sin colegios"}`,
          `- Link interno: ${listingUrl}`,
          "",
          "Motivo de la denuncia:",
          "",
          "",
          "Gracias.",
        ].join("\n"),
      };
    }

    if (user) {
      const userUrl = `loop://(main)/user/${user.id}`;
      const schools = user.schools.map((school) => school.name).join(", ");

      return {
        subject: `Denuncia de usuario ${user.id}`,
        body: [
          "Hola equipo de Loop,",
          "",
          "Quiero denunciar al siguiente usuario:",
          `- Usuario ID: ${user.id}`,
          `- Nombre: ${user.firstName} ${user.lastName}`,
          `- Email: ${user.email}`,
          `- Colegios: ${schools || "Sin colegios"}`,
          `- Link interno: ${userUrl}`,
          "",
          "Motivo de la denuncia:",
          "",
          "",
          "Gracias.",
        ].join("\n"),
      };
    }

    return null;
  };

  const showManualFallback = (to: string, subject: string, body: string) => {
    const textToCopy = `Para: ${to}\nAsunto: ${subject}\n\n${body}`;

    Alert.alert(
      "No se pudo abrir la app de correo",
      `Mandá un mail manualmente a ${to} con los datos de la denuncia.`,
      [
        {
          text: "Copiar manual",
          onPress: () => {
            setManualCopyText(textToCopy);
          },
        },
        {
          text: "Compartir texto",
          onPress: async () => {
            await Share.share({ message: textToCopy });
          },
        },
        { text: "Cerrar", style: "cancel" },
      ],
    );
  };

  const handleReportListing = async () => {
    const reportData = getReportData();
    if (!reportData) return;

    const to = REPORT_EMAIL ?? "";
    if (!to) {
      Alert.alert(
        "No disponible",
        "No hay un correo de denuncia configurado por ahora.",
      );
      return;
    }

    const { subject, body } = reportData;

    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (!canOpen) {
      showManualFallback(to, subject, body);
      return;
    }

    try {
      await Linking.openURL(mailtoUrl);
    } catch {
      showManualFallback(to, subject, body);
    }
  };

  const isDisabled = !listing && !user;
  return (
    <>
      <CustomButton
        {...props}
        className={"bg-alert " + props.className}
        onPress={handleReportListing}
        disabled={isDisabled || props.disabled}
      >
        <ButtonText>{label}</ButtonText>
      </CustomButton>

      <Modal
        visible={!!manualCopyText}
        transparent
        animationType="slide"
        onRequestClose={() => setManualCopyText("")}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-4 gap-3 max-h-[70%]">
            <Text className="text-main-text text-xl font-semibold">
              Copiar denuncia manualmente
            </Text>
            <Text className="text-secondary-text">
              Mantené presionado el texto para seleccionarlo y copiarlo.
            </Text>
            <ScrollView className="border border-stroke rounded-xl p-3 min-h-36 max-h-72">
              <Text selectable className="text-main-text">
                {manualCopyText}
              </Text>
            </ScrollView>
            <View className="flex-row gap-2">
              <CustomButton
                className="flex-1"
                onPress={async () => {
                  await Share.share({ message: manualCopyText });
                }}
              >
                <ButtonText className="text-base">Compartir</ButtonText>
              </CustomButton>
              <CustomButton
                className="flex-1 bg-main-text"
                onPress={() => setManualCopyText("")}
              >
                <ButtonText className="text-base">Cerrar</ButtonText>
              </CustomButton>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
