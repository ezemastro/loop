import { Text, View, Alert, ActivityIndicator } from "react-native";
import { MainView } from "../bases/MainView";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AvoidingKeyboard from "../AvoidingKeyboard";
import SchoolSelector from "@/components/selectors/SchoolSelector";
import CustomButton from "@/components/bases/CustomButton";
import ButtonText from "@/components/bases/ButtonText";
import { useGoogleLogin } from "@/hooks/useGoogleLogin";
import {
  getStoredGoogleCredential,
  clearStoredGoogleData,
} from "@/components/buttons/GoogleSignInButton";
import BackButton from "@/components/BackButton";

export default function SchoolSelection() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [credential, setCredential] = useState<string | null>(null);
  const [isLoadingCredential, setIsLoadingCredential] = useState(true);
  const googleLoginMutation = useGoogleLogin();

  // Cargar el credential guardado al montar el componente
  useEffect(() => {
    const loadCredential = async () => {
      try {
        const storedCredential = await getStoredGoogleCredential();
        if (!storedCredential) {
          Alert.alert(
            "Error",
            "No se encontró información de autenticación. Por favor, inicia sesión nuevamente.",
          );
          router.replace("/(auth)/login");
          return;
        }
        setCredential(storedCredential);
      } catch (error) {
        console.error("Error al cargar credential:", error);
        Alert.alert("Error", "Hubo un problema al cargar la sesión.");
        router.replace("/(auth)/login");
      } finally {
        setIsLoadingCredential(false);
      }
    };

    loadCredential();
  }, [router]);

  const handleCompleteSignIn = async () => {
    if (!credential) {
      Alert.alert(
        "Error",
        "No se encontró información de autenticación. Por favor, inicia sesión nuevamente.",
      );
      router.replace("/(auth)/login");
      return;
    }

    if (selectedSchools.length === 0) {
      Alert.alert(
        "Selección requerida",
        "Por favor selecciona al menos una escuela para continuar.",
      );
      return;
    }

    // Extraer los IDs de las escuelas seleccionadas
    const schoolIds = selectedSchools.map((school) => school.id);

    googleLoginMutation.mutate(
      {
        credential,
        schoolIds,
      },
      {
        onError: async (error: any) => {
          console.error("Error al completar registro:", error);
          const errorMessage =
            error?.message || "Error al completar el registro con Google";
          Alert.alert("Error", errorMessage);
        },
        onSuccess: async () => {
          // Limpiar datos guardados después del éxito
          await clearStoredGoogleData();
          console.log("Registro completado exitosamente");
          // La navegación se manejará automáticamente por el cambio en el estado de sesión
        },
      },
    );
  };

  // Mostrar loading mientras se carga el credential
  if (isLoadingCredential) {
    return (
      <MainView>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
          <Text className="color-main-text mt-4">Cargando...</Text>
        </View>
      </MainView>
    );
  }

  const isButtonDisabled =
    selectedSchools.length === 0 || googleLoginMutation.isPending;

  return (
    <MainView>
      <AvoidingKeyboard>
        <View
          className="flex-1"
          style={{
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: insets.top + 25,
          }}
        >
          <View className="flex-1 justify-center gap-4 p-6">
            <View className="absolute top-5 left-5">
              <BackButton />
            </View>
            <Text className="color-main-text text-lg text-center">
              Para terminar de crear su cuenta seleccione la o las escuelas a
              las que pertenece
            </Text>
            <SchoolSelector
              value={selectedSchools}
              multiple
              onChange={setSelectedSchools}
            />
            <CustomButton
              onPress={handleCompleteSignIn}
              disabled={isButtonDisabled}
            >
              {googleLoginMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ButtonText>Seleccionar</ButtonText>
              )}
            </CustomButton>
          </View>
        </View>
      </AvoidingKeyboard>
    </MainView>
  );
}
