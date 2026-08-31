import { Text, View, ActivityIndicator } from "react-native";
import { MainView, pageContentClassName } from "../bases/MainView";
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
import { useToast } from "@/components/ToastProvider";
import BackButton from "@/components/BackButton";
import { useThemeStore } from "@/stores/theme";

export default function SchoolSelection() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [credential, setCredential] = useState<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | undefined>(undefined);
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoadingCredential, setIsLoadingCredential] = useState(true);
  const googleLoginMutation = useGoogleLogin();
  const { showToast } = useToast();
  const setPreview = useThemeStore((state) => state.setPreview);
  const loadingContentClassName = pageContentClassName(
    "narrow",
    "flex-1 items-center justify-center",
  );
  const formContentClassName = pageContentClassName("narrow", "flex-1 justify-center gap-4 p-6");

  useEffect(() => {
    const loadCredential = async () => {
      try {
        const stored = await getStoredGoogleCredential();
        if (!stored.credential) {
          showToast(
            "No se encontró información de autenticación. Por favor, inicia sesión nuevamente.",
            "error",
          );
          router.replace("/(auth)/login");
          return;
        }
        setCredential(stored.credential);
        setInvitationToken(stored.invitationToken);
        setCommunity(stored.community);
        // La comunidad ya la resolvió el servidor en el primer paso: pintar con sus colores.
        setPreview(stored.community);
      } catch (error) {
        showToast("Hubo un problema al cargar la sesión.", "error");
        router.replace("/(auth)/login");
      } finally {
        setIsLoadingCredential(false);
      }
    };

    loadCredential();
  }, [router]);

  const handleCompleteSignIn = async () => {
    if (!credential) {
      showToast(
        "No se encontró información de autenticación. Por favor, inicia sesión nuevamente.",
        "error",
      );
      router.replace("/(auth)/login");
      return;
    }

    if (selectedSchools.length === 0) {
      showToast("Por favor selecciona al menos una escuela para continuar.", "warning");
      return;
    }

    const schoolIds = selectedSchools.map((school) => school.id);

    googleLoginMutation.mutate(
      {
        credential,
        schoolIds,
        invitationToken,
      },
      {
        onError: async (error: any) => {
          const message = error?.message || "Error al completar el registro con Google";
          showToast(message, "error");
        },
        onSuccess: async () => {
          await clearStoredGoogleData();
        },
      },
    );
  };

  if (isLoadingCredential) {
    return (
      <MainView>
        <View className={loadingContentClassName}>
          <ActivityIndicator size="large" />
          <Text className="color-main-text mt-4">Cargando...</Text>
        </View>
      </MainView>
    );
  }

  const isButtonDisabled = selectedSchools.length === 0 || googleLoginMutation.isPending;

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
          <View className={formContentClassName}>
            <View className="absolute top-5 left-5">
              <BackButton />
            </View>
            <Text className="color-main-text text-lg text-center">
              Para terminar de crear su cuenta seleccione la o las escuelas a las que pertenece
            </Text>
            {community ? (
              <Text className="text-secondary-text text-center">
                Colegios de <Text className="font-bold text-primary">{community.name}</Text>
              </Text>
            ) : null}
            <SchoolSelector
              value={selectedSchools}
              multiple
              communityId={community?.id}
              onChange={setSelectedSchools}
            />
            <CustomButton onPress={handleCompleteSignIn} disabled={isButtonDisabled}>
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
