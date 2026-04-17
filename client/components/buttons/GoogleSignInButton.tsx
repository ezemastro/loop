import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Alert,
  Platform,
} from "react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { useRouter } from "expo-router";
import { useGoogleLogin } from "@/hooks/useGoogleLogin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VALID_EMAIL_DOMAINS, WEB_GOOGLE_CLIENT_ID } from "@/config";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CREDENTIAL_KEY = "@google_credential";

interface GoogleSignInButtonProps {
  onError?: (error: string) => void;
  disabled?: boolean;
}

const ALLOWED_DOMAINS_TEXT = VALID_EMAIL_DOMAINS.map(
  (domain) => `@${domain}`,
).join(", ");

const formatGoogleLoginError = (error: any): string => {
  const fallbackError = "Error al iniciar sesión con Google";
  const rawError = String(error?.message || error || "").trim();
  const normalizedError = rawError.toLowerCase();

  if (!rawError) {
    return fallbackError;
  }

  if (
    normalizedError.includes("correo electrónico no está autorizado") ||
    normalizedError.includes("email no está autorizado")
  ) {
    return `Tu correo no pertenece a un dominio permitido. Dominios válidos: ${ALLOWED_DOMAINS_TEXT}`;
  }

  return rawError;
};

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onError,
  disabled = false,
}) => {
  if (Platform.OS === "web" && !WEB_GOOGLE_CLIENT_ID) {
    return null;
  }

  return <GoogleSignInButtonInner onError={onError} disabled={disabled} />;
};

const GoogleSignInButtonInner: React.FC<GoogleSignInButtonProps> = ({
  onError,
  disabled = false,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);
  const googleLoginMutation = useGoogleLogin();
  const [webRequest, _webResponse, promptWebGoogleSignIn] =
    Google.useIdTokenAuthRequest({
      webClientId: WEB_GOOGLE_CLIENT_ID,
      selectAccount: true,
    });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loginWithGoogleCredential = async (credential: string) => {
    // Guardar el credential temporalmente por si hay que completar signup.
    await AsyncStorage.setItem(GOOGLE_CREDENTIAL_KEY, credential);

    try {
      await googleLoginMutation.mutateAsync({ credential });
      await AsyncStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
      console.log("Login con Google completado exitosamente");
    } catch (error: any) {
      console.log("Error en login:", error);

      const errorMessage =
        error?.message?.toLowerCase() || error?.toString()?.toLowerCase() || "";

      if (
        errorMessage.includes("signup") ||
        errorMessage.includes("register")
      ) {
        console.log("Usuario nuevo detectado, redirigiendo a school selection");
        router.push("/(auth)/schoolSelection");
        return;
      }

      const displayError = formatGoogleLoginError(error);
      onError?.(displayError);
      Alert.alert("Error", displayError);
      await AsyncStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
      throw error;
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      if (Platform.OS === "web") {
        if (!WEB_GOOGLE_CLIENT_ID) {
          const configError =
            "Falta EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID para iniciar sesión con Google en web.";
          onError?.(configError);
          Alert.alert("Configuración incompleta", configError);
          return;
        }

        setIsLoading(true);

        const result = await promptWebGoogleSignIn();

        if (result.type !== "success") {
          return;
        }

        const credential = result.params?.id_token;

        if (!credential) {
          throw new Error("No se recibió el token de Google en web");
        }

        await loginWithGoogleCredential(credential);
        return;
      }

      setIsLoading(true);

      // Verificar disponibilidad de Google Play Services (Android)
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      // Obtener información del usuario de Google
      const userInfo = (await GoogleSignin.signIn()).data;

      // Verificar que recibimos el token
      if (!userInfo?.idToken) {
        throw new Error("No se recibió el token de Google");
      }

      await loginWithGoogleCredential(userInfo.idToken);
    } catch (err: any) {
      let errorMessage = "Error desconocido al iniciar sesión";

      // Manejar errores específicos de Google Sign-In
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = "Inicio de sesión cancelado";
      } else if (err.code === statusCodes.IN_PROGRESS) {
        errorMessage = "Inicio de sesión en progreso";
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = "Google Play Services no disponible";
      } else if (err.message) {
        errorMessage = err.message;
      }

      console.error("Error en Google Sign-In:", err);
      onError?.(errorMessage);
      Alert.alert("Error", errorMessage);
      await AsyncStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const isButtonDisabled =
    disabled ||
    isLoading ||
    googleLoginMutation.isPending ||
    (Platform.OS === "web" && !webRequest);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isButtonDisabled && styles.buttonDisabled]}
        onPress={handleGoogleSignIn}
        disabled={isButtonDisabled}
        activeOpacity={0.8}
      >
        {isLoading || googleLoginMutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={styles.buttonContent}>
            {/* Icono de Google */}
            <View style={styles.iconContainer}>
              <GoogleIcon />
            </View>
            <Text style={styles.buttonText}>Continuar con Google</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.hintText}>
        Dominios permitidos: {ALLOWED_DOMAINS_TEXT}
      </Text>
    </View>
  );
};

// Componente simple del ícono de Google
const GoogleIcon = () => (
  <View style={styles.googleIcon}>
    <Text style={styles.googleIconText}>G</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: "#B0BEC5",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  iconContainer: {
    width: 24,
    height: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4285F4",
  },
  hintText: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },
});

// Helper functions para acceder al credential guardado desde otras pantallas
export const getStoredGoogleCredential = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(GOOGLE_CREDENTIAL_KEY);
  } catch (error) {
    console.error("Error al obtener credential guardado:", error);
    return null;
  }
};

export const clearStoredGoogleData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
  } catch (error) {
    console.error("Error al limpiar datos de Google guardados:", error);
  }
};
