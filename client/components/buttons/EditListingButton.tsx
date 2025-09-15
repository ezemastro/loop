import CustomButton from "../bases/CustomButton";
import { EditIcon } from "../Icons";
import { useRouter } from "expo-router";

export default function EditListingButton({
  listingId,
}: {
  listingId: string;
}) {
  const router = useRouter();
  const handleEdit = () => {
    router.push({
      pathname: "/(main)/listing/[listingId]/edit",
      params: { listingId },
    });
  };
  return (
    <CustomButton onPress={handleEdit}>
      <EditIcon className="text-white" />
    </CustomButton>
  );
}
