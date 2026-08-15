import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
} from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { useRouter } from "expo-router";
import { useGoogleLogin } from "@/hooks/useGoogleLogin";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WEB_GOOGLE_CLIENT_ID } from "@/config";
import { getUserFriendlyErrorMessage, isNetworkError } from "@/services/errorMapping";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CREDENTIAL_KEY = "@google_credential";
const GOOGLE_INVITATION_KEY = "@google_invitation_token";
const GOOGLE_COMMUNITY_KEY = "@google_community";

interface GoogleSignInButtonProps {
  onError?: (error: string) => void;
  disabled?: boolean;
  /** Token de `/register?invite=…`, para entrar a la comunidad del admin que generó el link. */
  invitationToken?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onError,
  disabled = false,
  invitationToken,
}) => {
  if (Platform.OS === "web" && !WEB_GOOGLE_CLIENT_ID) {
    return null;
  }

  return (
    <GoogleSignInButtonInner
      onError={onError}
      disabled={disabled}
      invitationToken={invitationToken}
    />
  );
};

const GoogleSignInButtonInner: React.FC<GoogleSignInButtonProps> = ({
  onError,
  disabled = false,
  invitationToken,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);
  const googleLoginMutation = useGoogleLogin();
  const [webRequest, _webResponse, promptWebGoogleSignIn] = Google.useIdTokenAuthRequest({
    webClientId: WEB_GOOGLE_CLIENT_ID,
    selectAccount: true,
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loginWithGoogleCredential = async (credential: string) => {
    await AsyncStorage.setItem(GOOGLE_CREDENTIAL_KEY, credential);
    // La invitación viaja junto al credential porque el registro con Google es en dos pasos y el
    // segundo ocurre en otra pantalla, que tiene que reenviar exactamente lo mismo.
    if (invitationToken) {
      await AsyncStorage.setItem(GOOGLE_INVITATION_KEY, invitationToken);
    } else {
      await AsyncStorage.removeItem(GOOGLE_INVITATION_KEY);
    }
    await AsyncStorage.removeItem(GOOGLE_COMMUNITY_KEY);

    try {
      await googleLoginMutation.mutateAsync({ credential, invitationToken });
      await clearStoredGoogleData();
    } catch (error: any) {
      const errorCode = error?.errorCode;

      if (errorCode === "SCHOOL_IDS_REQUIRED") {
        // El servidor ya resolvió la comunidad: guardarla evita tener que volver a deducirla en el
        // segundo paso, donde no hay ni correo tipeado ni sesión.
        const community = (error?.data as { community?: Community } | undefined)?.community;
        if (community) {
          await AsyncStorage.setItem(GOOGLE_COMMUNITY_KEY, JSON.stringify(community));
        }
        router.push("/(auth)/schoolSelection");
        return;
      }

      const displayError = getUserFriendlyErrorMessage(error);
      onError?.(displayError);
      await clearStoredGoogleData();
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      if (Platform.OS === "web") {
        if (!WEB_GOOGLE_CLIENT_ID) {
          const configError =
            "Falta EXPO_PUBLIC_WEB_GOOGLE_CLIENT_ID para iniciar sesión con Google en web.";
          onError?.(configError);
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

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const userInfo = (await GoogleSignin.signIn()).data;

      if (!userInfo?.idToken) {
        throw new Error("No se recibió el token de Google");
      }

      await loginWithGoogleCredential(userInfo.idToken);
    } catch (err: any) {
      let errorMessage = "Error desconocido al iniciar sesión";

      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = "Inicio de sesión cancelado";
      } else if (err.code === statusCodes.IN_PROGRESS) {
        errorMessage = "Inicio de sesión en progreso";
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = "Google Play Services no disponible";
      } else if (isNetworkError(err)) {
        errorMessage = "Error de conexión. Revisa tu conexión a internet.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      onError?.(errorMessage);
      await clearStoredGoogleData();
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
            <View style={styles.iconContainer}>
              <GoogleIcon />
            </View>
            <Text style={styles.buttonText}>Continuar con Google</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

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

export interface StoredGoogleSignIn {
  credential: string | null;
  invitationToken?: string;
  community: Community | null;
}

/**
 * Devuelve todo lo que dejó el primer paso del alta con Google: el credential, la invitación con la
 * que se inició y la comunidad que el servidor resolvió al pedir los colegios.
 */
export const getStoredGoogleCredential = async (): Promise<StoredGoogleSignIn> => {
  try {
    const [credential, invitationToken, rawCommunity] = await Promise.all([
      AsyncStorage.getItem(GOOGLE_CREDENTIAL_KEY),
      AsyncStorage.getItem(GOOGLE_INVITATION_KEY),
      AsyncStorage.getItem(GOOGLE_COMMUNITY_KEY),
    ]);

    let community: Community | null = null;
    if (rawCommunity) {
      try {
        community = JSON.parse(rawCommunity) as Community;
      } catch {
        // Un stash corrupto no debe romper el alta: se sigue sin filtrar por comunidad.
      }
    }

    return { credential, invitationToken: invitationToken ?? undefined, community };
  } catch (error) {
    console.error("Error al obtener credential guardado:", error);
    return { credential: null, community: null };
  }
};

export const clearStoredGoogleData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      GOOGLE_CREDENTIAL_KEY,
      GOOGLE_INVITATION_KEY,
      GOOGLE_COMMUNITY_KEY,
    ]);
  } catch (error) {
    console.error("Error al limpiar datos de Google guardados:", error);
  }
};
