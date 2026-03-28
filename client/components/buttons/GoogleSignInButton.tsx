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

import { useRouter } from "expo-router";
import { useGoogleLogin } from "@/hooks/useGoogleLogin";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GOOGLE_CREDENTIAL_KEY = "@google_credential";

interface GoogleSignInButtonProps {
  onError?: (error: string) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onError,
  disabled = false,
}) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);
  const googleLoginMutation = useGoogleLogin();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      if (Platform.OS === "web") {
        const webError =
          "Google Sign-In nativo no esta disponible en web en esta configuracion.";
        onError?.(webError);
        Alert.alert("No disponible", webError);
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

      // Guardar el credential del usuario temporalmente
      // por si necesitamos redirigir a la selección de escuelas
      await AsyncStorage.setItem(GOOGLE_CREDENTIAL_KEY, userInfo.idToken);

      // Intentar login directo (sin schoolIds inicialmente)
      // El backend nos dirá si el usuario ya existe o necesita registrarse

      googleLoginMutation.mutate(
        {
          credential: userInfo.idToken,
        },
        {
          onError: async (error: any) => {
            console.log("Error en login:", error);

            // Verificar si el error indica que necesita hacer signup
            const errorMessage =
              error?.message?.toLowerCase() ||
              error?.toString()?.toLowerCase() ||
              "";

            if (
              errorMessage.includes("signup") ||
              errorMessage.includes("register")
            ) {
              // Usuario nuevo - redirigir a selección de escuelas
              console.log(
                "Usuario nuevo detectado, redirigiendo a school selection",
              );
              router.push("/(auth)/schoolSelection");
            } else {
              // Otro tipo de error
              const displayError =
                error?.message || "Error al iniciar sesión con Google";
              onError?.(displayError);
              Alert.alert("Error", displayError);

              // Limpiar datos guardados si hay error
              await AsyncStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
            }
          },
          onSuccess: async () => {
            // Login exitoso - limpiar datos temporales
            await AsyncStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
            console.log("Login con Google completado exitosamente");
          },
        },
      );
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
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const isButtonDisabled =
    disabled || isLoading || googleLoginMutation.isPending;

  return (
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
  );
};

// Componente simple del ícono de Google
const GoogleIcon = () => (
  <View style={styles.googleIcon}>
    <Text style={styles.googleIconText}>G</Text>
  </View>
);

const styles = StyleSheet.create({
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
