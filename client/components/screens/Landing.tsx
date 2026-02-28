import ButtonText from "@/components/bases/ButtonText";
import CustomButton from "@/components/bases/CustomButton";
import { GoogleSignInButton } from "@/components/buttons/GoogleSignInButton";
import { useRouter } from "expo-router";
import { View, Text, Image, ScrollView } from "react-native";
export default function Landing() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1">
      <View className="py-16 px-6 flex-1 h-screen-safe">
        <Image
          source={require("../../assets/reditinere_logo.png")}
          className="w-40 h-32 mx-auto"
          style={{ resizeMode: "contain" }}
        />
        <Image
          source={require("../../assets/full_logo.png")}
          className="w-80 h-36 mx-auto"
          style={{ resizeMode: "contain" }}
        />
        <Text className="text-center text-main-text font-bold text-xl mt-4 w-80 mx-auto">
          Una app donde podrás darle una segunda vida a tus útiles usados.
        </Text>
        <Text className="text-main-text text-lg mx-auto text-center my-8">
          ¡Únete a nuestra comunidad y descubre cómo puedes contribuir a un
          mundo más sostenible mientras encuentras tesoros ocultos en la
          comunidad!
        </Text>
        <Text className="text-main-text w-96 mx-auto text-center my-2 mt-auto">
          Accede con un solo clic usando tu cuenta de Google
        </Text>
        <GoogleSignInButton />
        <Text className="text-main-text w-96 mx-auto text-center my-2 mt-auto">
          ¿Primera vez aquí? ¡Regístrate ahora!
        </Text>
        <CustomButton onPress={() => router.push("/register")}>
          <ButtonText>Registrarse</ButtonText>
        </CustomButton>
        <Text className="text-main-text w-96 mx-auto text-center my-2 mt-4">
          ¿Ya tienes una cuenta? ¡Inicia sesión ahora!
        </Text>
        <CustomButton onPress={() => router.push("/login")}>
          <ButtonText>Iniciar Sesión</ButtonText>
        </CustomButton>
      </View>
    </ScrollView>
  );
}
