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
    <CustomButton className="bg-alert" onPress={handleDelete}>
      <DeleteIcon className="text-white" />
    </CustomButton>
  );
}
