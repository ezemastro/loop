import { useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";
import CustomModal from "./bases/CustomModal";
import TextTitle from "./bases/TextTitle";
import { useListingNewOffer } from "@/hooks/useListingNewOffer";
import { useListingDeleteOffer } from "@/hooks/useListingDeleteOffer";
import { useSelf } from "@/hooks/useSelf";
import { useListingMarkReceived } from "@/hooks/useListingMarkReceived";
import { useListingCancel } from "@/hooks/useListingCancel";
import { useRouter } from "expo-router";
import { useToast } from "@/components/ToastProvider";
import { getUserFriendlyErrorMessage } from "@/services/errorMapping";
import { showAlert } from "@/services/showAlert";

const CANCEL_TITLE = "¿Cancelar el loop?";
const CANCEL_MESSAGE =
  "Se deshace el intercambio y cada uno recupera los Loopies que tenía bloqueados. No se puede volver atrás.";
const CANCEL_KEEP = "No, seguir";
const CANCEL_CONFIRM = "Sí, cancelar";

export default function ListingButtons({
  listing,
  onMutate,
}: {
  listing: Listing;
  onMutate: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { refetch: userRefetch } = useSelf();
  const { showToast } = useToast();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const { mutateAsync: createOffer } = useListingNewOffer({
    listingId: listing.id,
    price: listing.price,
  });
  const { mutateAsync: deleteOffer } = useListingDeleteOffer({
    listingId: listing.id,
  });
  const { mutateAsync: markReceived } = useListingMarkReceived({
    listingId: listing.id,
  });
  const { mutateAsync: cancelLoop, isPending: isCancelling } = useListingCancel({
    listingId: listing.id,
  });

  const handleCreateOffer = async () => {
    try {
      await createOffer();
      userRefetch();
      onMutate();
    } catch (error) {
      showToast(getUserFriendlyErrorMessage(error), "error");
    }
  };
  const handleDeleteOffer = async () => {
    try {
      await deleteOffer();
      userRefetch();
      onMutate();
    } catch (error) {
      showToast(getUserFriendlyErrorMessage(error), "error");
    }
  };
  const handleMarkReceived = async () => {
    try {
      await markReceived();
      userRefetch();
      onMutate();
    } catch (error) {
      showToast(getUserFriendlyErrorMessage(error), "error");
    }
  };

  const runCancel = async () => {
    setIsCancelConfirmOpen(false);
    try {
      await cancelLoop();
      userRefetch();
      onMutate();
    } catch (error) {
      // The server re-checks status and party under a row lock, so a stale screen (the counterparty
      // already cancelled or marked it received) comes back as a rejection rather than a no-op.
      // That has to reach the user, not just the console.
      showAlert("No se pudo cancelar el loop", getUserFriendlyErrorMessage(error));
    }
  };

  const handleCancelPress = () => {
    if (isCancelling) return;
    // `showAlert` draws a real two-button dialog on native. On web it cannot render actions, so by
    // its own contract it surfaces the message and immediately runs the first non-cancel action —
    // for a credit-moving confirmation that would be confirming on the user's behalf. Web therefore
    // degrades to the modal below, which is exactly the "caller opens its own web fallback UI"
    // escape hatch `services/showAlert.ts` documents.
    if (Platform.OS === "web") {
      setIsCancelConfirmOpen(true);
      return;
    }
    showAlert(CANCEL_TITLE, CANCEL_MESSAGE, [
      { text: CANCEL_KEEP, style: "cancel" },
      { text: CANCEL_CONFIRM, onPress: () => void runCancel() },
    ]);
  };

  /**
   * Mirrors `ListingsModel.cancelListing` (server/api/src/models/listings.ts): it accepts the call
   * only when the listing is `accepted` and the caller is the seller or the buyer. Rendering the
   * button outside those two conditions would just buy the user a 409.
   */
  const canCancel =
    listing.listingStatus === "accepted" &&
    !!user?.id &&
    (user.id === listing.seller.id || user.id === listing.buyer?.id);

  const cancelButton = canCancel ? (
    <>
      <CustomButton className="bg-alert/20" disabled={isCancelling} onPress={handleCancelPress}>
        {isCancelling ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <ButtonText>Cancelar</ButtonText>
        )}
      </CustomButton>
      <CustomModal
        isVisible={isCancelConfirmOpen}
        handleClose={() => setIsCancelConfirmOpen(false)}
      >
        <View className="gap-4 bg-background p-6 rounded-lg w-full max-w-md">
          <TextTitle>{CANCEL_TITLE}</TextTitle>
          <Text className="text-main-text text-lg">{CANCEL_MESSAGE}</Text>
          <View className="flex-row gap-4">
            <CustomButton
              className="w-auto max-w-none flex-grow"
              onPress={() => setIsCancelConfirmOpen(false)}
            >
              <ButtonText>{CANCEL_KEEP}</ButtonText>
            </CustomButton>
            <CustomButton
              className="w-auto max-w-none flex-grow bg-alert"
              onPress={() => void runCancel()}
            >
              <ButtonText>{CANCEL_CONFIRM}</ButtonText>
            </CustomButton>
          </View>
        </View>
      </CustomModal>
    </>
  ) : null;

  switch (listing.listingStatus) {
    case "published":
      if (user?.id === listing.seller.id) {
        return null;
      }
      return (
        <CustomButton onPress={() => handleCreateOffer()} className="w-auto max-w-none flex-grow">
          <ButtonText>Loopear</ButtonText>
        </CustomButton>
      );
    case "offered":
      if (user?.id === listing.seller.id) {
        return (
          <CustomButton
            className="w-auto max-w-none flex-grow"
            onPress={() => {
              router.push({
                pathname: "/(main)/listing/[listingId]/offer",
                params: { listingId: listing.id },
              });
            }}
          >
            <ButtonText>Elegir Loop</ButtonText>
          </CustomButton>
        );
      }
      if (user?.id === listing.buyer?.id) {
        return (
          <CustomButton
            className="w-auto max-w-none bg-alert flex-grow"
            onPress={() => handleDeleteOffer()}
          >
            <ButtonText>Cancelar</ButtonText>
          </CustomButton>
        );
      }
      return null;
    case "accepted":
      if (user?.id === listing.seller.id) {
        return (
          <>
            <CustomButton
              onPress={() =>
                listing.buyer?.id &&
                router.push({
                  pathname: "/(main)/(tabs)/messages/[userId]",
                  params: { userId: listing.buyer?.id },
                })
              }
              className="w-auto max-w-none flex-grow"
            >
              <ButtonText>Mensaje</ButtonText>
            </CustomButton>
            {cancelButton}
          </>
        );
      }
      if (user?.id === listing.buyer?.id) {
        return (
          <>
            <CustomButton
              onPress={() => handleMarkReceived()}
              className="w-auto max-w-none flex-grow"
            >
              <ButtonText>Recibido</ButtonText>
            </CustomButton>
            {cancelButton}
          </>
        );
      }
      return null;
    default:
      return null;
  }
}
