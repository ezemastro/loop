import { useState } from "react";
import { Alert, Share } from "react-native";
import { openMailComposer } from "@/services/emailComposer";

/**
 * Shared send + fallback state for any screen that opens the user's mail composer. Extracted so
 * `ReportButton` and the settings screen's contact entries share one fallback instead of each
 * carrying its own copy of the Alert/Share/manual-copy dance.
 */
export function useMailComposer() {
  const [manualCopyText, setManualCopyText] = useState("");

  const showFallback = (to: string, subject: string, body: string) => {
    const textToCopy = `Para: ${to}\nAsunto: ${subject}\n\n${body}`;

    Alert.alert(
      "No se pudo abrir la app de correo",
      `Escribí manualmente a ${to} con el mensaje.`,
      [
        {
          text: "Copiar manual",
          onPress: () => setManualCopyText(textToCopy),
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

  const sendMail = async (to: string, subject: string, body: string): Promise<boolean> => {
    const canOpen = await openMailComposer(to, subject, body);
    if (!canOpen) {
      showFallback(to, subject, body);
    }
    return canOpen;
  };

  const closeFallback = () => setManualCopyText("");

  return { manualCopyText, sendMail, closeFallback };
}
