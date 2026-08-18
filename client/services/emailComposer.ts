import { Linking, Platform } from "react-native";

/**
 * Abre la app de correo con un mail ya redactado. En web abre la web de Gmail en una pestaña nueva.
 * Devuelve `false` si no se pudo abrir (por ejemplo sin app de correo instalada).
 */
export const openMailComposer = async (to: string, subject?: string, body?: string) => {
  const extra = [
    subject ? `su=${encodeURIComponent(subject)}` : "",
    body ? `body=${encodeURIComponent(body)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  if (Platform.OS === "web") {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}${extra ? `&${extra}` : ""}`;
    window.open(url, "_blank");
    return true;
  }

  const url = `mailto:${encodeURIComponent(to)}${extra ? `?${extra}` : ""}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};
