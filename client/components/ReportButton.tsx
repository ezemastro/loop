import { REPORT_EMAIL } from "@/config";
import { Alert, type PressableProps } from "react-native";
import ButtonText from "./bases/ButtonText";
import CustomButton from "./bases/CustomButton";
import MailFallbackSheet from "./bases/MailFallbackSheet";
import { useMailComposer } from "@/hooks/useMailComposer";

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
  const { manualCopyText, sendMail, closeFallback } = useMailComposer();

  const getReportData = () => {
    if (listing) {
      const listingUrl = `loop://(main)/listing/${listing.id}`;
      const sellerSchools = listing.seller.schools.map((school) => school.name).join(", ");

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

  const handleReportListing = async () => {
    const reportData = getReportData();
    if (!reportData) return;

    const to = REPORT_EMAIL ?? "";
    if (!to) {
      Alert.alert("No disponible", "No hay un correo de denuncia configurado por ahora.");
      return;
    }

    const { subject, body } = reportData;

    await sendMail(to, subject, body);
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

      <MailFallbackSheet text={manualCopyText} onClose={closeFallback} />
    </>
  );
}
