import { useDeleteListing } from "@/hooks/useDeleteListing";
import CustomButton from "../bases/CustomButton";
import { DeleteIcon } from "../Icons";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function DeleteListingButton({
  listingId,
  onDelete,
}: {
  listingId: string;
  onDelete?: () => void;
}) {
  const queryClient = useQueryClient();
  const { mutate: deleteListing, isSuccess } = useDeleteListing();
  const handleDelete = () => {
    deleteListing(listingId);
  };
  useEffect(() => {
    if (isSuccess && onDelete) {
      onDelete();
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
    }
  }, [isSuccess, onDelete, queryClient, listingId]);

  return (
    <CustomButton
      variant="secondary"
      size="sm"
      className="w-auto max-w-none"
      accessibilityLabel="Eliminar publicación"
      onPress={handleDelete}
    >
      <DeleteIcon size={18} className="text-main-text" />
    </CustomButton>
  );
}
