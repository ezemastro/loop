import { useDeleteListing } from "@/hooks/useDeleteListing";
import CustomButton from "../bases/CustomButton";
import { DeleteIcon } from "../Icons";
import { useEffect } from "react";

export default function DeleteListingButton({
  listingId,
  onDelete,
}: {
  listingId: string;
  onDelete?: () => void;
}) {
  const { mutate: deleteListing, isSuccess } = useDeleteListing();
  const handleDelete = () => {
    deleteListing(listingId);
  };
  useEffect(() => {
    if (isSuccess && onDelete) {
      onDelete();
    }
  }, [isSuccess, onDelete]);

  return (
    <CustomButton className="bg-alert" onPress={handleDelete}>
      <DeleteIcon className="text-white" />
    </CustomButton>
  );
}
