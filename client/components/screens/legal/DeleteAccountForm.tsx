/**
 * Public `/borrar-cuenta` form (spec `public-legal-pages`, "Account Deletion Form"). Posts to the
 * already-public `POST /me/delete-request` (`server/api/src/index.ts`), unchanged by this change.
 *
 * Copy is voseo throughout (spec, "Copy Register") and the success message never claims the
 * account was found — the endpoint always answers 204 to avoid becoming an email-enumeration
 * oracle, so the page can only ever confirm "we recorded the request", never "we found you".
 *
 * `reason` was dropped from this form rather than silently discarded (design D8, Open Questions,
 * task 2.5): persisting it would need a third migration outside the `0015`/`0016` slot this block
 * was assigned, so the simpler, still-honest option is to not collect it at all.
 */
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import Head from "expo-router/head";
import { MainView, pageContentClassName } from "../../bases/MainView";
import CustomButton from "../../bases/CustomButton";
import ButtonText from "../../bases/ButtonText";
import TextTitle from "../../bases/TextTitle";
import Error from "../../Error";
import { useRequestAccountDeletion } from "@/hooks/useRequestAccountDeletion";
import { isValidEmailFormat } from "@/services/validations";

export default function DeleteAccountForm() {
  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState(false);
  const { mutate, isPending, isSuccess, error } = useRequestAccountDeletion();
  const contentClassName = pageContentClassName("narrow", "gap-4 p-4 pt-6");

  const handleSubmit = () => {
    if (!isValidEmailFormat(email)) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    mutate({ email: email.trim() });
  };

  return (
    <MainView>
      <Head>
        <title>Eliminar cuenta - Loop</title>
      </Head>
      <View className={contentClassName}>
        <TextTitle className="mb-2 text-3xl">Eliminar cuenta</TextTitle>
        <Text className="text-main-text text-lg leading-6">
          Enviá esta solicitud con el email de tu cuenta y un administrador la va a procesar.
        </Text>

        {isSuccess ? (
          <Text className="text-main-text text-lg leading-6" testID="delete-account-success">
            Listo: si ese email corresponde a una cuenta, registramos tu solicitud de borrado.
          </Text>
        ) : (
          <>
            <View className="gap-1">
              <Text className="color-main-text text-xl">Email de la cuenta:</Text>
              <TextInput
                className="border border-stroke rounded p-2 bg-white"
                placeholder="tu-email@colegio.edu.ar"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {validationError && <Error textClassName="text-alert">Ingresá un email válido</Error>}
            </View>
            {error && (
              <Error textClassName="text-alert">
                No pudimos procesar el pedido. Probá de nuevo en un momento.
              </Error>
            )}
            <CustomButton onPress={handleSubmit} disabled={isPending}>
              <ButtonText>{isPending ? "Enviando…" : "Enviar solicitud"}</ButtonText>
            </CustomButton>
          </>
        )}
      </View>
    </MainView>
  );
}
