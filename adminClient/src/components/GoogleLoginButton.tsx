import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { adminApi } from "@/api/adminApi";
import { useState } from "react";
import { useSessionStore } from "@/stores/session";

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function GoogleLoginButton({
  onSuccess,
  onError,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const login = useSessionStore((state) => state.login);

  /**
   * Maneja la respuesta exitosa de Google
   * Google devuelve un objeto con la propiedad 'credential' que es un JWT
   */
  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse,
  ) => {
    try {
      setIsLoading(true);

      // Verificar que recibimos el credential
      if (!credentialResponse.credential) {
        throw new Error("No se recibió el credential de Google");
      }

      // Enviar el credential al backend
      const response = await adminApi.googleLogin(
        credentialResponse.credential,
      );

      if (response.success && response.data?.admin) {
        login(response.data?.admin.email, response.data?.admin.fullName);
      } else {
        throw new Error("Error al iniciar sesión con Google");
      }

      // Llamar al callback de éxito
      onSuccess?.();
    } catch (error) {
      console.error("Error en Google login:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error al iniciar sesión con Google";
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Maneja errores en el proceso de login de Google
   * Esto se llama si hay un error ANTES de recibir el credential
   */
  const handleGoogleError = () => {
    console.error("Error en el login de Google");
    onError?.(
      "Error al iniciar sesión con Google. Por favor, intenta nuevamente.",
    );
  };

  return (
    <div className="google-login-wrapper">
      {isLoading ? (
        <div className="flex items-center justify-center p-2">
          <span className="text-sm">Iniciando sesión...</span>
        </div>
      ) : (
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap={false} // Puedes activar esto para login automático con One Tap
          // Personalización del botón:
          theme="outline" // 'outline' | 'filled_blue' | 'filled_black'
          size="large" // 'large' | 'medium' | 'small'
          text="signin_with" // 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
          shape="rectangular" // 'rectangular' | 'pill' | 'circle' | 'square'
          logo_alignment="left" // 'left' | 'center'
        />
      )}
    </div>
  );
}
