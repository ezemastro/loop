import { useAuth } from "@/hooks/useAuth";
import CustomButton from "./bases/CustomButton";
import ButtonText from "./bases/ButtonText";
import { useListingNewOffer } from "@/hooks/useListingNewOffer";
import { useListingDeleteOffer } from "@/hooks/useListingDeleteOffer";
import { useSelf } from "@/hooks/useSelf";
import { useListingMarkReceived } from "@/hooks/useListingMarkReceived";
import { useRouter } from "expo-router";

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
  // TODO - Implementar elección de precio de oferta
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

  const handleCreateOffer = async () => {
    try {
      await createOffer();
      userRefetch();
      onMutate();
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };
  const handleDeleteOffer = async () => {
    try {
      await deleteOffer();
      userRefetch();
      onMutate();
    } catch (error) {
      console.error("Error deleting offer:", error);
    }
  };
  const handleMarkReceived = async () => {
    try {
      await markReceived();
      userRefetch();
      onMutate();
    } catch (error) {
      console.error("Error marking as received:", error);
    }
  };
  switch (listing.listingStatus) {
    case "published":
      if (user?.id === listing.seller.id) {
        return null;
      }
      return (
        <CustomButton onPress={() => handleCreateOffer()} className="flex-grow">
          <ButtonText>Loopear</ButtonText>
        </CustomButton>
      );
    case "offered":
      if (user?.id === listing.seller.id) {
        return (
          <CustomButton
            className="flex-grow"
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
            className="bg-alert flex-grow"
            onPress={() => handleDeleteOffer()}
          >
            <ButtonText>Cancelar</ButtonText>
          </CustomButton>
        );
      }
    case "accepted":
      if (user?.id === listing.seller.id) {
        return (
          <>
            <CustomButton onPress={() => {}} className="flex-grow">
              <ButtonText>Mensaje</ButtonText>
            </CustomButton>
            <CustomButton className="bg-alert/20">
              <ButtonText>Cancelar</ButtonText>
            </CustomButton>
          </>
        );
      }
      if (user?.id === listing.buyer?.id) {
        return (
          <CustomButton
            onPress={() => handleMarkReceived()}
            className="flex-grow"
          >
            <ButtonText>Recibido</ButtonText>
          </CustomButton>
        );
      }
  }
}
