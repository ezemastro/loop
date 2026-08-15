import ButtonText from "@/components/bases/ButtonText";
import CustomButton from "@/components/bases/CustomButton";
import { MainView } from "@/components/bases/MainView";
import TextTitle from "@/components/bases/TextTitle";
import { GoogleSignInButton } from "@/components/buttons/GoogleSignInButton";
import AllowedDomainsNotice from "@/components/AllowedDomainsNotice";
import { CO2Icon, CreditIcon, H20Icon, WasteIcon } from "@/components/Icons";
import { GOOGLE_OAUTH_READY } from "@/config";
import { useToast } from "@/components/ToastProvider";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useThemeStore } from "@/stores/theme";
import { getUrl } from "@/services/getUrl";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, Image, ScrollView } from "react-native";

const STEPS = [
  {
    title: "Publicá lo que ya no usás",
    description: "Útiles, uniformes y libros que quedaron chicos vuelven a circular.",
  },
  {
    title: "Ganá loopies",
    description: "Cada entrega te suma la moneda virtual de Loop. No se mueve dinero real.",
  },
  {
    title: "Conseguí lo que necesitás",
    description: "Canjeá tus loopies por lo que otras familias de tu comunidad publicaron.",
  },
];

const SectionLabel = ({ children }: { children: string }) => (
  <Text className="text-secondary-text text-xs text-center uppercase tracking-widest">
    {children}
  </Text>
);

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const colors = useThemeColors();
  // La comunidad tentativa: puesta por el registro al tipear el correo o por un link de invitación.
  const previewCommunity = useThemeStore((state) => state.previewCommunity);

  const handleGoogleError = (error: string) => {
    showToast(error, "error");
  };

  const impacts = [
    { label: "Menos residuos", icon: <WasteIcon color={colors.PRIMARY} size={26} /> },
    { label: "Menos CO₂", icon: <CO2Icon color={colors.SECONDARY} size={26} /> },
    { label: "Menos agua", icon: <H20Icon color={colors.TERTIARY} size={26} /> },
  ];

  return (
    <MainView>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
      >
        {/* max-w + mx-auto: en web la landing se centra en vez de estirarse a todo el monitor. */}
        <View className="w-full max-w-xl mx-auto px-5 gap-9">
          <View className="items-center gap-4">
            <Image
              source={require("../../assets/full_logo.png")}
              // Relativo al ancho disponible para que no desborde en pantallas chicas.
              className="w-56 max-w-full"
              style={{ height: 100 }}
              resizeMode="contain"
            />

            {previewCommunity ? (
              <View className="items-center gap-2">
                {previewCommunity.media?.url ? (
                  <Image
                    source={{ uri: getUrl(previewCommunity.media.url) }}
                    style={{ width: 72, height: 72 }}
                    resizeMode="contain"
                  />
                ) : null}
                <SectionLabel>Tu comunidad</SectionLabel>
                <Text className="text-2xl font-bold text-center text-primary">
                  {previewCommunity.name}
                </Text>
              </View>
            ) : (
              <View className="bg-primary/10 border border-primary/25 rounded-full px-4 py-1.5">
                <Text className="text-primary text-center text-xs font-semibold">
                  Una comunidad por colegio
                </Text>
              </View>
            )}
          </View>

          <View className="items-center gap-3">
            <TextTitle className="text-3xl font-bold">
              Dale una segunda vida a los útiles del colegio
            </TextTitle>
            <Text className="text-main-text/80 text-base text-center leading-6">
              {previewCommunity
                ? `Comprá, vendé y regalá entre las familias de ${previewCommunity.name}, sin gastar dinero real.`
                : "Loop funciona por comunidades: entrás con el correo que te dio tu colegio y todo lo que ves es de las familias que estudian con vos."}
            </Text>
            <View className="flex-row items-center gap-2 bg-credits/10 rounded-full px-4 py-2">
              <CreditIcon size={18} />
              <Text className="text-credits text-sm font-semibold">
                Se intercambia con loopies, no con plata
              </Text>
            </View>
          </View>

          <View className="gap-3">
            <SectionLabel>Cada intercambio suma</SectionLabel>
            <View className="flex-row gap-2">
              {impacts.map((impact) => (
                <View
                  key={impact.label}
                  className="flex-1 items-center gap-2 bg-white border border-stroke rounded-xl px-2 py-4"
                >
                  {impact.icon}
                  <Text className="text-main-text text-xs text-center font-semibold">
                    {impact.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text className="text-secondary-text text-xs text-center">
              Cada categoría tiene su ahorro estimado de residuos, CO₂ y agua.
            </Text>
          </View>

          <View className="gap-4">
            <SectionLabel>Cómo funciona</SectionLabel>
            {STEPS.map((step, index) => (
              <View key={step.title} className="flex-row gap-3 items-start">
                <View className="w-8 h-8 rounded-full bg-tertiary items-center justify-center">
                  <Text className="text-white font-bold">{index + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-main-text text-base font-semibold">{step.title}</Text>
                  <Text className="text-main-text/70 text-sm leading-5">{step.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* El aviso trae su propio `mx-4`; se compensa para que quede alineado con el resto. */}
          <View className="-mx-4">
            <AllowedDomainsNotice />
          </View>

          <View className="gap-3">
            <CustomButton onPress={() => router.push("/register")} className="bg-primary py-4">
              <ButtonText>Registrarse</ButtonText>
            </CustomButton>
            <CustomButton
              onPress={() => router.push("/login")}
              className="bg-transparent border border-tertiary py-4"
            >
              {/* Inline: `ButtonText` fija `text-white` en su className y no lo mergea. */}
              <ButtonText style={{ color: colors.TERTIARY }}>Iniciar Sesión</ButtonText>
            </CustomButton>

            {GOOGLE_OAUTH_READY && (
              <>
                <View className="flex-row items-center gap-3 my-1">
                  <View className="flex-1 h-px bg-stroke" />
                  <Text className="text-secondary-text text-xs">o</Text>
                  <View className="flex-1 h-px bg-stroke" />
                </View>
                <GoogleSignInButton onError={handleGoogleError} />
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </MainView>
  );
}
