import { View, ScrollView } from "react-native";
import CategorySelector from "../selectors/CategorySelector";
import { useEffect, useState } from "react";
import CustomModal from "../bases/CustomModal";
import TextTitle from "../bases/TextTitle";
import CloseModalButton from "../CloseModalButton";
import AvoidingKeyboard from "../AvoidingKeyboard";
import CustomButton from "../bases/CustomButton";
import ButtonText from "../bases/ButtonText";
import { Field, TextField } from "../bases/Field";
import { useCreateWish, useModifyWish } from "@/hooks/useWishes";

export default function ModifyWishModal({
  wish,
  isVisible,
  handleClose,
}: {
  wish: UserWish | null;
  isVisible: boolean;
  handleClose: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState(wish?.category || null);
  const [comment, setComment] = useState(wish?.comment || "");
  const { mutateAsync: modifyWish, isPending: isModifying } = useModifyWish();
  const { mutateAsync: createWish, isPending: isCreating } = useCreateWish();
  const isLoading = isModifying || isCreating;

  useEffect(() => {
    setSelectedCategory(wish?.category || null);
    setComment(wish?.comment || "");
  }, [wish]);

  const handleSubmit = () => {
    if (!selectedCategory) {
      return;
    }
    if (!!wish) {
      // Modify existing wish
      modifyWish({
        wishId: wish.id,
        categoryId: selectedCategory?.id,
        comment: comment === "" ? null : comment,
      }).then(() => {
        handleClose();
      });
    } else {
      // Create new wish
      createWish({
        categoryId: selectedCategory?.id,
        comment: comment === "" ? null : comment,
      }).then(() => {
        handleClose();
      });
    }
  };
  return (
    <CustomModal handleClose={handleClose} isVisible={isVisible}>
      {(modalMaxHeight) => (
        <AvoidingKeyboard className="items-center justify-center flex-1 w-full">
          <View
            className="overflow-hidden bg-background rounded-lg w-full"
            style={{ maxHeight: modalMaxHeight }}
          >
            <ScrollView className="p-4" contentContainerClassName="gap-4">
              <CloseModalButton onClose={handleClose} />
              <TextTitle>{wish ? "Modificar deseo" : "Agregar deseo"}</TextTitle>
              <Field label="Categoría">
                <CategorySelector
                  value={selectedCategory}
                  onChange={(cat) => setSelectedCategory(cat)}
                />
              </Field>
              <Field label="Comentario">
                <TextField
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Contanos qué estás buscando"
                  multiline
                  numberOfLines={4}
                />
              </Field>
              <CustomButton onPress={handleSubmit} disabled={isLoading || !selectedCategory}>
                <ButtonText>{wish ? "Guardar cambios" : "Agregar deseo"}</ButtonText>
              </CustomButton>
            </ScrollView>
          </View>
        </AvoidingKeyboard>
      )}
    </CustomModal>
  );
}
