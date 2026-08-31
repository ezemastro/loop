import CustomButton from "@/components/bases/CustomButton";
import Error from "@/components/Error";
import { GoogleSignInButton } from "@/components/buttons/GoogleSignInButton";
import {
  EmailIcon,
  EyeIcon,
  LeafIcon,
  LockIcon,
  RepeatIcon,
  StarIcon,
  TagIcon,
} from "@/components/Icons";
import Loader from "@/components/Loader";
import { useToast } from "@/components/ToastProvider";
import { GOOGLE_OAUTH_READY } from "@/config";
import { useLoginForm } from "@/hooks/useLoginForm";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STEPS = [
  {
    title: "Publicá",
    description: "lo que ya no usás",
    icon: TagIcon,
  },
  {
    title: "Ganá loopies",
    description: "por cada entrega",
    icon: StarIcon,
  },
  {
    title: "Canjeá",
    description: "por lo que necesitás",
    icon: RepeatIcon,
  },
];

const ActionLabel = ({ children, color = "#FFFFFF" }: { children: string; color?: string }) => (
  <Text className="text-center text-sm font-bold" style={{ color }}>
    {children}
  </Text>
);

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { showToast } = useToast();
  const isNarrow = width < 640;
  const [showPassword, setShowPassword] = useState(false);
  const {
    formData,
    setFormData,
    errors,
    handleSubmit,
    isLoginError,
    loginErrorMessage,
    isLoginLoading,
    loginAsDemo,
  } = useLoginForm();

  const handleGoogleError = (error: string) => {
    showToast(error, "error");
  };

  const googleButton = GOOGLE_OAUTH_READY ? (
    <GoogleSignInButton appearance="light" onError={handleGoogleError} />
  ) : null;

  const registerButton = (
    <CustomButton
      onPress={() => router.push("/register")}
      className="rounded-lg border bg-white py-4"
      style={{ borderColor: colors.PRIMARY }}
    >
      <ActionLabel color={colors.PRIMARY}>Registrarse</ActionLabel>
    </CustomButton>
  );

  const loginButton = (
    <CustomButton
      onPress={isNarrow ? () => router.push("/login") : handleSubmit}
      disabled={!isNarrow && isLoginLoading}
      className="rounded-lg bg-tertiary py-4"
    >
      <ActionLabel>Iniciar sesión</ActionLabel>
    </CustomButton>
  );

  /**
   * Entrada a la demo. Es un enlace y no un botón a propósito: quien viene a usar Loop tiene que
   * ver dos caminos (registrarse o entrar), no tres. Esto es una nota al pie para el que solo
   * quiere espiar — fácil de encontrar si lo buscás, invisible como decisión si no.
   */
  const demoLink = (
    <Pressable
      onPress={loginAsDemo}
      disabled={isLoginLoading}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Explorar la demo sin crear una cuenta"
      className="mt-5 self-center"
    >
      <Text
        className="text-center underline"
        style={{ color: colors.SECONDARY_TEXT, fontSize: 13 }}
      >
        Explorar la demo sin crear cuenta
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-white">
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <View
          className="absolute"
          style={{
            top: -130,
            right: -120,
            width: 360,
            height: 320,
            borderRadius: 180,
            backgroundColor: "#FFF1E8",
          }}
        />
        <LeafIcon
          color="#F3D4BF"
          size={78}
          style={{ position: "absolute", top: 62, right: 50, transform: [{ rotate: "25deg" }] }}
        />
        <View
          className="absolute"
          style={{
            bottom: -170,
            left: -130,
            width: 380,
            height: 350,
            borderRadius: 190,
            backgroundColor: "#EEF8E9",
          }}
        />
        <LeafIcon
          color="#C7E0BE"
          size={96}
          style={{ position: "absolute", bottom: 72, left: 56, transform: [{ rotate: "-35deg" }] }}
        />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingTop: insets.top + (isNarrow ? 22 : 34),
          paddingBottom: insets.bottom + (isNarrow ? 30 : 24),
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
        }}
      >
        <View className="w-full max-w-3xl items-center">
          <Image
            source={require("../../assets/full_logo.png")}
            resizeMode="contain"
            style={{ width: isNarrow ? 205 : 280, height: isNarrow ? 58 : 76 }}
          />

          <View className="mt-7 items-center">
            <Text
              className="text-center font-bold"
              style={{
                color: colors.MAIN_TEXT,
                fontSize: isNarrow ? 28 : 38,
                lineHeight: isNarrow ? 34 : 44,
                maxWidth: 570,
              }}
            >
              Dale una <Text style={{ color: colors.SECONDARY }}>segunda vida</Text>
              {"\n"}a los <Text style={{ color: colors.PRIMARY }}>útiles</Text> del colegio
            </Text>
            <Text
              className="mt-3 text-center"
              style={{ color: colors.SECONDARY_TEXT, fontSize: isNarrow ? 15 : 16 }}
            >
              Intercambiá lo que ya no usás por lo que necesitás.
            </Text>
            <View className="mt-5 flex-row items-center rounded-full bg-secondary/10 px-4 py-2">
              <RepeatIcon color={colors.SECONDARY} size={18} />
              <Text className="ml-2 text-xs font-semibold" style={{ color: colors.SECONDARY }}>
                Se intercambia con loopies, no con plata
              </Text>
            </View>
          </View>

          {isNarrow ? (
            <View className="mt-9 w-full max-w-sm gap-3">
              {registerButton}
              {loginButton}
              {googleButton}
            </View>
          ) : (
            <View
              className="mt-6 w-full max-w-md rounded-2xl bg-white p-8"
              style={{
                borderWidth: 1,
                borderColor: "#EEEEEE",
                shadowColor: "#16352B",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 22,
                elevation: 5,
              }}
            >
              <View className="gap-3">
                <View>
                  <View
                    className="h-14 flex-row items-center rounded-lg border bg-white px-4"
                    style={{ borderColor: colors.STROKE }}
                  >
                    <EmailIcon color={colors.SECONDARY} size={21} />
                    <TextInput
                      className="ml-3 flex-1 text-base text-main-text"
                      placeholder="Correo institucional"
                      placeholderTextColor={colors.SECONDARY_TEXT}
                      value={formData.email}
                      onChangeText={(email) => setFormData({ ...formData, email })}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  {errors.email ? (
                    <Error textClassName="text-xs text-alert">
                      Introduce tu correo electrónico
                    </Error>
                  ) : null}
                </View>

                <View>
                  <View
                    className="h-14 flex-row items-center rounded-lg border bg-white px-4"
                    style={{ borderColor: colors.STROKE }}
                  >
                    <LockIcon color={colors.PRIMARY} size={21} />
                    <TextInput
                      className="ml-3 flex-1 text-base text-main-text"
                      placeholder="Contraseña"
                      placeholderTextColor={colors.SECONDARY_TEXT}
                      value={formData.password}
                      onChangeText={(password) => setFormData({ ...formData, password })}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={() => setShowPassword((value) => !value)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      <EyeIcon color={colors.SECONDARY_TEXT} size={20} />
                    </Pressable>
                  </View>
                  {errors.password ? (
                    <Error textClassName="text-xs text-alert">Introduce una contraseña</Error>
                  ) : null}
                </View>

                {isLoginError && loginErrorMessage ? (
                  <Error textClassName="text-xs text-alert">{loginErrorMessage}</Error>
                ) : null}
                {isLoginLoading ? <Loader /> : null}
                {loginButton}
                <View className="my-1 flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-stroke" />
                  <Text className="text-xs" style={{ color: colors.SECONDARY_TEXT }}>
                    o
                  </Text>
                  <View className="h-px flex-1 bg-stroke" />
                </View>
                {googleButton}
                {registerButton}
              </View>
            </View>
          )}

          {demoLink}

          {!isNarrow ? (
            <View className="mt-12 w-full max-w-3xl flex-row items-center">
              {STEPS.map(({ title, description, icon: Icon }, index) => (
                <View key={title} className="flex-1 flex-row items-center">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${colors.SECONDARY}12` }}
                    >
                      <Icon color={colors.SECONDARY} size={20} />
                    </View>
                    <View>
                      <Text className="text-xs font-bold" style={{ color: colors.MAIN_TEXT }}>
                        {index + 1}. {title}
                      </Text>
                      <Text className="mt-1 text-xs" style={{ color: colors.SECONDARY_TEXT }}>
                        {description}
                      </Text>
                    </View>
                  </View>
                  {index < STEPS.length - 1 ? (
                    <View className="mx-4 h-px flex-1 border-t border-dashed border-stroke" />
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {!isNarrow ? (
            <View className="mt-10 flex-row items-center gap-2">
              <LeafIcon color={colors.SECONDARY} size={18} />
              <Text className="text-xs" style={{ color: colors.SECONDARY_TEXT }}>
                Juntos construimos un colegio más sostenible.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
