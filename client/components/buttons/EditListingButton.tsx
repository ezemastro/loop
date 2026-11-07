import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { EditIcon } from "../Icons";
import { useRouter } from "expo-router";

export default function EditListingButton({
  listingId,
  label,
}: {
  listingId: string;
  /** Optional visible label next to the icon (the desktop panel shows it). */
  label?: string;
}) {
  const router = useRouter();
  const handleEdit = () => {
    router.push({
      pathname: "/(main)/listing/[listingId]/edit",
      params: { listingId },
    });
  };
  return (
    <CustomButton
      variant="secondary"
      size="sm"
      className="w-auto max-w-none"
      accessibilityLabel="Editar publicación"
      onPress={handleEdit}
    >
      <EditIcon size={18} className="text-main-text" />
      {label ? <ButtonText>{label}</ButtonText> : null}
    </CustomButton>
  );
}
