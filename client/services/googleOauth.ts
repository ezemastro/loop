import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";
import { IOS_GOOGLE_CLIENT_ID, WEB_GOOGLE_CLIENT_ID } from "../config";

// Configurar Google Sign-In (ejecutar al inicio de la app)
export const configureGoogleSignIn = () => {
  if (Platform.OS === "web") {
    return;
  }

  GoogleSignin.configure({
    webClientId: WEB_GOOGLE_CLIENT_ID,
    iosClientId: IOS_GOOGLE_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
};
