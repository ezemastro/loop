import { View, Text, FlatList } from "react-native";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { MainView, pageContentClassName } from "../bases/MainView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionStore } from "@/stores/session";
import TextTitle from "../bases/TextTitle";
import { buildTermsSections, TERMS_VERSION } from "@/content/legal/termsDocument";
import { useAcceptTerms } from "@/hooks/useAcceptTerms";
import { showAlert } from "@/services/showAlert";

/**
 * In-app terms screen (design D4). Consumes the same `buildTermsSections` document the public
 * `/terminos` route renders, with `user.community.name` in place of the old hardcoded community
 * constant (proposal, `Terms.tsx:37,76` → dropped).
 */
export default function TermsPage() {
  const insets = useSafeAreaInsets();
  const user = useSessionStore((state) => state.user);
  const setHasAcceptedTerms = useSessionStore((state) => state.setHasAcceptedTerms);
  const logout = useSessionStore((state) => state.logout);
  const acceptTerms = useAcceptTerms();

  const termsContentClassName = pageContentClassName("narrow", "py-2 px-2");
  const actionsRowClassName = pageContentClassName("narrow", "flex-row gap-2");

  const handleAccept = () => {
    // Optimistic: the local flag flips immediately so the guard in `_layout.tsx` lets the user
    // through even if the network is slow. If the POST fails, this is still correct — it is
    // exactly the "don't lock the user out" fallback (spec, "Acceptance Failure Must Not Lock
    // Users Out") — and the request retries implicitly on next launch via `setUser`, which
    // recomputes `hasAcceptedTerms` from the server's `termsVersion` every time.
    setHasAcceptedTerms(true);
    acceptTerms.mutate(
      { termsVersion: TERMS_VERSION },
      {
        onError: () => {
          // Local flag already true; nothing else to do here beyond not crashing the app.
        },
      },
    );
  };

  const handleReject = () => {
    // `BackHandler.exitApp()` used to run here — a no-op on `react-native-web` that left a
    // browser user stranded on this screen with no feedback (proposal C7). Signing out with an
    // explanation is a defined outcome on every platform.
    setHasAcceptedTerms(false);
    showAlert(
      "Términos no aceptados",
      "Para usar Loop es necesario aceptar los términos. Cerramos tu sesión.",
    );
    logout();
  };

  const communityName = user?.community?.name ?? "tu comunidad";
  const termsSections = buildTermsSections(communityName);

  return (
    <View
      className="flex-1"
      style={{
        paddingBottom: insets.bottom,
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <MainView className="p-4">
        <FlatList
          className="flex-1"
          data={termsSections}
          contentContainerClassName={termsContentClassName}
          renderItem={({ item }) => (
            <>
              {item.type === "title" && (
                <TextTitle className="mb-4 text-3xl">{item.content}</TextTitle>
              )}
              {item.type === "subtitle" && (
                <TextTitle className="mb-3 mt-3 text-left">{item.content}</TextTitle>
              )}
              {item.type === "paragraph" && (
                <Text className="mb-2 text-main-text text-lg leading-6">{item.content}</Text>
              )}
              {item.type === "list-item" && (
                <Text className="mb-3 text-main-text text-lg leading-6">• {item.content}</Text>
              )}
            </>
          )}
        />
        <View className={actionsRowClassName}>
          <CustomButton onPress={handleReject} className="bg-alert">
            <ButtonText>Rechazar</ButtonText>
          </CustomButton>
          <CustomButton onPress={handleAccept} className="w-auto max-w-none flex-grow">
            <ButtonText>Aceptar</ButtonText>
          </CustomButton>
        </View>
      </MainView>
    </View>
  );
}
