import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { IOS_GOOGLE_CLIENT_ID, WEB_GOOGLE_CLIENT_ID } from "../config";

// Configurar Google Sign-In (ejecutar al inicio de la app)
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: WEB_GOOGLE_CLIENT_ID,
    iosClientId: IOS_GOOGLE_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
};
